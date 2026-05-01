require('dotenv').config();
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// JWT Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'Access denied' });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: 'Invalid token' });
        req.user = user;
        next();
    });
};

// Signup Route
app.post('/signup', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: { 
                name, 
                email, 
                password: hashedPassword,
                categories: {
                    create: [
                        { name: 'Salary', type: 'INCOME' },
                        { name: 'Gift', type: 'INCOME' },
                        { name: 'Food', type: 'EXPENSE' },
                        { name: 'Rent', type: 'EXPENSE' },
                        { name: 'Transport', type: 'EXPENSE' },
                        { name: 'General', type: 'EXPENSE' }
                    ]
                }
            }
        });

        const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Login Route
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Profile Route (Protected)
app.get('/profile', authenticateToken, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { id: true, name: true, email: true }
        });
        res.json(user);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Category Routes
app.get('/categories', authenticateToken, async (req, res) => {
    try {
        const categories = await prisma.category.findMany({
            where: {
                OR: [
                    { userId: req.user.id },
                    { userId: null } // System-wide categories if any
                ]
            }
        });
        res.json(categories);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching categories' });
    }
});

app.post('/categories', authenticateToken, async (req, res) => {
    try {
        const { name, type } = req.body;
        const category = await prisma.category.create({
            data: { name, type, userId: req.user.id }
        });
        res.status(201).json(category);
    } catch (error) {
        res.status(500).json({ message: 'Error creating category' });
    }
});

app.delete('/categories/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        // Check if category has transactions
        const transactionsCount = await prisma.transaction.count({ where: { categoryId: id } });
        
        if (transactionsCount > 0) {
            // Find or create a "General" category for this user
            let generalCategory = await prisma.category.findFirst({
                where: { name: 'General', userId: req.user.id }
            });
            if (!generalCategory) {
                generalCategory = await prisma.category.create({
                    data: { name: 'General', type: 'EXPENSE', userId: req.user.id }
                });
            }
            // Reassign transactions
            await prisma.transaction.updateMany({
                where: { categoryId: id },
                data: { categoryId: generalCategory.id }
            });
        }

        await prisma.category.delete({ where: { id } });
        res.json({ message: 'Category deleted and transactions reassigned' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting category' });
    }
});

app.patch('/categories/:id/budget', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { budget } = req.body;
        const category = await prisma.category.update({
            where: { id, userId: req.user.id },
            data: { budget: parseFloat(budget) }
        });
        res.json(category);
    } catch (error) {
        res.status(500).json({ message: 'Error updating budget' });
    }
});

// Transaction Routes
app.post('/transactions', authenticateToken, async (req, res) => {
    try {
        let { amount, description, type, categoryId, date } = req.body;
        
        if (amount === undefined || !description || !type || !categoryId) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        // Handle precision: Round to 2 decimal places
        const roundedAmount = Math.round(parseFloat(amount) * 100) / 100;

        const transaction = await prisma.transaction.create({
            data: {
                amount: roundedAmount,
                description,
                type,
                categoryId,
                date: date ? new Date(date) : new Date(),
                userId: req.user.id
            },
            include: { category: true }
        });
        res.status(201).json(transaction);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error creating transaction' });
    }
});

app.put('/transactions/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, description, type, categoryId, date } = req.body;

        const roundedAmount = Math.round(parseFloat(amount) * 100) / 100;

        const transaction = await prisma.transaction.update({
            where: { id, userId: req.user.id },
            data: {
                amount: roundedAmount,
                description,
                type,
                categoryId,
                date: new Date(date)
            },
            include: { category: true }
        });
        res.json(transaction);
    } catch (error) {
        res.status(500).json({ message: 'Error updating transaction' });
    }
});

app.get('/transactions', authenticateToken, async (req, res) => {
    try {
        const transactions = await prisma.transaction.findMany({
            where: { userId: req.user.id },
            include: { category: true },
            orderBy: { date: 'desc' }
        });
        res.json(transactions);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching transactions' });
    }
});

app.get('/summary', authenticateToken, async (req, res) => {
    try {
        const transactions = await prisma.transaction.findMany({
            where: { userId: req.user.id }
        });

        const summary = transactions.reduce((acc, curr) => {
            // Precise addition to avoid float issues
            const amount = Math.round(curr.amount * 100);
            if (curr.type === 'INCOME') acc.totalIncome += amount;
            else acc.totalExpenses += amount;
            return acc;
        }, { totalIncome: 0, totalExpenses: 0 });

        res.json({
            totalIncome: summary.totalIncome / 100,
            totalExpenses: summary.totalExpenses / 100,
            balance: (summary.totalIncome - summary.totalExpenses) / 100
        });
    } catch (error) {
        res.status(500).json({ message: 'Error calculating summary' });
    }
});

// Delete Transaction
app.delete('/transactions/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const transaction = await prisma.transaction.findUnique({ where: { id } });

        if (!transaction || transaction.userId !== req.user.id) {
            return res.status(404).json({ message: 'Transaction not found' });
        }

        await prisma.transaction.delete({ where: { id } });
        res.json({ message: 'Transaction deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error deleting transaction' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
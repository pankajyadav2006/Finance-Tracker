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
            data: { name, email, password: hashedPassword }
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

// Create Transaction
app.post('/transactions', authenticateToken, async (req, res) => {
    try {
        const { amount, description, type, category, date } = req.body;
        
        if (!amount || !description || !type || !category) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        const transaction = await prisma.transaction.create({
            data: {
                amount: parseFloat(amount),
                description,
                type,
                category,
                date: date ? new Date(date) : new Date(),
                userId: req.user.id
            }
        });
        res.status(201).json(transaction);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error creating transaction' });
    }
});

// Get User Transactions
app.get('/transactions', authenticateToken, async (req, res) => {
    try {
        const transactions = await prisma.transaction.findMany({
            where: { userId: req.user.id },
            orderBy: { date: 'desc' }
        });
        res.json(transactions);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching transactions' });
    }
});

// Get Summary
app.get('/summary', authenticateToken, async (req, res) => {
    try {
        const transactions = await prisma.transaction.findMany({
            where: { userId: req.user.id }
        });

        const summary = transactions.reduce((acc, curr) => {
            if (curr.type === 'INCOME') acc.totalIncome += curr.amount;
            else acc.totalExpenses += curr.amount;
            return acc;
        }, { totalIncome: 0, totalExpenses: 0 });

        res.json({
            ...summary,
            balance: summary.totalIncome - summary.totalExpenses
        });
    } catch (error) {
        console.error(error);
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
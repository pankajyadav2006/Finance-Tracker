'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { LogOut, User as UserIcon, Plus, Trash2, Edit3, TrendingUp, TrendingDown, Wallet, Target, Settings, FileText, ExternalLink } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  type: 'INCOME' | 'EXPENSE';
  budget?: number | null;
}

interface Transaction {
  id: string;
  amount: number;
  description: string;
  type: 'INCOME' | 'EXPENSE';
  categoryId: string;
  category: Category;
  date: string;
  receiptUrl?: string | null;
}

interface Summary {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function Dashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [summary, setSummary] = useState<Summary>({ totalIncome: 0, totalExpenses: 0, balance: 0 });
  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [showBudgetSettings, setShowBudgetSettings] = useState(false);
  const router = useRouter();

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [categoryId, setCategoryId] = useState('');
  const [receipt, setReceipt] = useState<File | null>(null);

  const fetchData = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const [transRes, sumRes, catRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/transactions`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/summary`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/categories`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (!transRes.ok || !sumRes.ok || !catRes.ok) throw new Error('Failed to fetch data');

      setTransactions(await transRes.json());
      setSummary(await sumRes.json());
      setCategories(await catRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Budget Calculations
  const budgetProgress = useMemo(() => {
    return categories
      .filter(c => c.type === 'EXPENSE' && c.budget && c.budget > 0)
      .map(c => {
        const spent = transactions
          .filter(t => t.categoryId === c.id)
          .reduce((sum, t) => sum + Math.abs(t.amount), 0);
        return { ...c, spent, percentage: Math.min((spent / (c.budget || 1)) * 100, 100) };
      });
  }, [categories, transactions]);

  // Chart Data Processing
  const pieData = useMemo(() => {
    const expenseData: Record<string, number> = {};
    transactions.filter(t => t.type === 'EXPENSE').forEach(t => {
      const name = t.category?.name || 'Uncategorized';
      expenseData[name] = (expenseData[name] || 0) + Math.abs(t.amount);
    });
    return Object.entries(expenseData).map(([name, value]) => ({ name, value }));
  }, [transactions]);

  const barData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    return last7Days.map(date => {
      const dayTrans = transactions.filter(t => t.date.startsWith(date));
      const income = dayTrans.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + t.amount, 0);
      const expense = dayTrans.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + Math.abs(t.amount), 0);
      return { 
        name: new Date(date).toLocaleDateString(undefined, { weekday: 'short' }),
        income, 
        expense 
      };
    });
  }, [transactions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    const token = localStorage.getItem('token');

    const formData = new FormData();
    formData.append('amount', amount);
    formData.append('description', description);
    formData.append('type', type);
    formData.append('categoryId', categoryId);
    if (receipt) formData.append('receipt', receipt);
    if (editingId) {
        const trans = transactions.find(t => t.id === editingId);
        if (trans) formData.append('date', trans.date);
    } else {
        formData.append('date', new Date().toISOString());
    }

    try {
      const url = editingId 
        ? `${process.env.NEXT_PUBLIC_API_URL}/transactions/${editingId}`
        : `${process.env.NEXT_PUBLIC_API_URL}/transactions`;
      
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (res.ok) {
        resetForm();
        await fetchData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setFormLoading(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setAmount('');
    setDescription('');
    setCategoryId('');
    setType('EXPENSE');
    setReceipt(null);
  };

  const handleEdit = (t: Transaction) => {
    setEditingId(t.id);
    setAmount(t.amount.toString());
    setDescription(t.description);
    setType(t.type);
    setCategoryId(t.categoryId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    const token = localStorage.getItem('token');
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/transactions/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      await fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateBudget = async (id: string, budget: string) => {
    const token = localStorage.getItem('token');
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/categories/${id}/budget`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ budget })
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredCategories = categories.filter(c => c.type === type);

  if (loading) return (
    <div className="premium-container" style={{ textAlign: 'center', marginTop: '20vh' }}>
      <div className="loader"></div>
      <p style={{ color: 'var(--accent-color)', marginTop: '1rem', fontWeight: '500' }}>Analyzing Finances...</p>
    </div>
  );

  return (
    <div className="premium-container" style={{ maxWidth: '1200px', paddingBottom: '5rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '800', background: 'linear-gradient(to right, #fff, #888)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Wealth Dashboard
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>Real-time overview of your financial health.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button onClick={() => router.push('/reports')} className="premium-button" style={{ width: 'auto', padding: '0.8rem 1.5rem', background: 'rgba(0, 112, 243, 0.1)', color: 'var(--accent-color)', border: '1px solid var(--accent-color)', borderRadius: '12px', fontWeight: '600' }}>
            Generate Reports
          </button>
          <button onClick={() => router.push('/profile')} className="premium-button" style={{ width: 'auto', padding: '0.8rem', borderRadius: '50%', background: 'var(--card-bg)' }}>
            <UserIcon size={20} />
          </button>
          <button onClick={() => { localStorage.removeItem('token'); router.push('/login'); }} className="premium-button" style={{ width: 'auto', padding: '0.8rem', borderRadius: '50%', background: 'rgba(255, 77, 77, 0.1)', color: '#ff4d4d' }}>
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        <div className="glass-card" style={{ padding: '2rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ background: 'rgba(0, 255, 136, 0.1)', padding: '1rem', borderRadius: '16px', color: 'var(--success-color)' }}>
            <TrendingUp size={32} />
          </div>
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Total Income</p>
            <h2 style={{ fontSize: '2rem', fontWeight: '800' }}>${summary.totalIncome.toFixed(2)}</h2>
          </div>
        </div>
        <div className="glass-card" style={{ padding: '2rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ background: 'rgba(255, 77, 77, 0.1)', padding: '1rem', borderRadius: '16px', color: 'var(--error-color)' }}>
            <TrendingDown size={32} />
          </div>
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Total Expenses</p>
            <h2 style={{ fontSize: '2rem', fontWeight: '800' }}>${summary.totalExpenses.toFixed(2)}</h2>
          </div>
        </div>
        <div className="glass-card" style={{ padding: '2rem', display: 'flex', alignItems: 'center', gap: '1.5rem', border: '1px solid var(--accent-color)' }}>
          <div style={{ background: 'rgba(0, 112, 243, 0.1)', padding: '1rem', borderRadius: '16px', color: 'var(--accent-color)' }}>
            <Wallet size={32} />
          </div>
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Net Balance</p>
            <h2 style={{ fontSize: '2rem', fontWeight: '800' }}>${summary.balance.toFixed(2)}</h2>
          </div>
        </div>
      </div>

      {/* Budgeting Section */}
      <section style={{ marginBottom: '4rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Target size={24} /> Budgeting Goals</h2>
          <button onClick={() => setShowBudgetSettings(!showBudgetSettings)} className="link-text" style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <Settings size={16} /> {showBudgetSettings ? 'Close Settings' : 'Manage Budgets'}
          </button>
        </div>

        {showBudgetSettings ? (
          <div className="glass-card" style={{ padding: '2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
            {categories.filter(c => c.type === 'EXPENSE').map(c => (
              <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{c.name}</label>
                <input 
                  type="number" 
                  defaultValue={c.budget || ''} 
                  onBlur={(e) => handleUpdateBudget(c.id, e.target.value)}
                  placeholder="Set limit..."
                  className="premium-input"
                  style={{ padding: '0.5rem' }}
                />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {budgetProgress.length === 0 && (
              <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', gridColumn: '1 / -1' }}>
                No active budgets. Click "Manage Budgets" to set goals for your spending.
              </div>
            )}
            {budgetProgress.map(b => (
              <div key={b.id} className="glass-card" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <span style={{ fontWeight: '600' }}>{b.name}</span>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    ${b.spent.toFixed(0)} / <span style={{ color: '#fff' }}>${b.budget?.toFixed(0)}</span>
                  </span>
                </div>
                <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', overflow: 'hidden' }}>
                  <div style={{ 
                    height: '100%', 
                    width: `${b.percentage}%`, 
                    background: b.percentage > 90 ? 'var(--error-color)' : b.percentage > 70 ? '#ffcc00' : 'var(--accent-color)',
                    transition: 'width 1s ease-out'
                  }}></div>
                </div>
                <div style={{ marginTop: '0.5rem', textAlign: 'right', fontSize: '0.75rem', color: b.percentage > 90 ? 'var(--error-color)' : 'var(--text-muted)' }}>
                  {b.percentage > 100 ? 'Over Budget!' : `${b.percentage.toFixed(0)}% used`}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Charts Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem', marginBottom: '4rem' }}>
        <div className="glass-card" style={{ padding: '2rem' }}>
          <h3 style={{ marginBottom: '2rem', fontSize: '1.2rem', fontWeight: '600' }}>Weekly Analytics</h3>
          <div style={{ width: '100%', height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                  itemStyle={{ fontSize: '0.9rem' }}
                />
                <Bar dataKey="income" fill="var(--success-color)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" fill="var(--error-color)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '2rem' }}>
          <h3 style={{ marginBottom: '2rem', fontSize: '1.2rem', fontWeight: '600' }}>Expense Distribution</h3>
          <div style={{ width: '100%', height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '3rem' }}>
        {/* Form */}
        <div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Plus size={24} /> {editingId ? 'Modify' : 'Record'} Transaction
          </h2>
          <form onSubmit={handleSubmit} className="glass-card" style={{ padding: '2rem' }}>
            <div className="input-group">
              <label>Transaction Type</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" onClick={() => { setType('INCOME'); setCategoryId(''); }} style={{ flex: 1, padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)', background: type === 'INCOME' ? 'var(--success-color)' : 'transparent', color: type === 'INCOME' ? '#000' : '#fff', cursor: 'pointer', fontWeight: '600' }}>Income</button>
                <button type="button" onClick={() => { setType('EXPENSE'); setCategoryId(''); }} style={{ flex: 1, padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)', background: type === 'EXPENSE' ? 'var(--error-color)' : 'transparent', color: type === 'EXPENSE' ? '#000' : '#fff', cursor: 'pointer', fontWeight: '600' }}>Expense</button>
              </div>
            </div>

            <div className="input-group">
              <label>Amount ($)</label>
              <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="premium-input" placeholder="0.00" required />
            </div>

            <div className="input-group">
              <label>Category</label>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="premium-input" style={{ appearance: 'none' }} required>
                <option value="">Select Category</option>
                {filteredCategories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="input-group">
              <label>Description</label>
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="premium-input" placeholder="What was this for?" required />
            </div>

            <div className="input-group">
              <label>Receipt Upload (Optional)</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type="file" 
                  onChange={(e) => setReceipt(e.target.files?.[0] || null)} 
                  className="premium-input" 
                  accept="image/*,application/pdf"
                  style={{ padding: '0.8rem' }}
                />
                <FileText size={18} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>Images or PDFs up to 5MB</p>
            </div>

            <button type="submit" className="premium-button" disabled={formLoading}>
              {formLoading ? 'Processing...' : (editingId ? 'Update Record' : 'Save Transaction')}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="link-text" style={{ width: '100%', marginTop: '1rem', background: 'none', border: 'none', cursor: 'pointer' }}>Cancel Edit</button>
            )}
          </form>
        </div>

        {/* List */}
        <div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Transaction History</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {transactions.length === 0 && (
              <div className="glass-card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                No records found. Start adding transactions to see your history.
              </div>
            )}
            {transactions.map((t) => (
              <div key={t.id} className="glass-card fade-in" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: t.type === 'INCOME' ? 'var(--success-color)' : 'var(--error-color)' }}>
                    {t.type === 'INCOME' ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
                  </div>
                  <div>
                    <div style={{ fontSize: '1.1rem', fontWeight: '600' }}>{t.description}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {t.category?.name} • {new Date(t.date).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: '800', color: t.type === 'INCOME' ? 'var(--success-color)' : (t.amount < 0 ? 'var(--success-color)' : 'var(--error-color)') }}>
                    {t.type === 'INCOME' ? '+' : ''}{t.amount.toFixed(2)}
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                    {t.receiptUrl && (
                        <a href={`${process.env.NEXT_PUBLIC_API_URL}${t.receiptUrl}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-color)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.3rem', textDecoration: 'none' }}>
                            <ExternalLink size={14} /> Receipt
                        </a>
                    )}
                    <button onClick={() => handleEdit(t)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Edit3 size={14} /> Edit</button>
                    <button onClick={() => handleDelete(t.id)} style={{ background: 'none', border: 'none', color: 'rgba(255, 77, 77, 0.6)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Trash2 size={14} /> Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

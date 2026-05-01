'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Category {
  id: string;
  name: string;
  type: 'INCOME' | 'EXPENSE';
}

interface Transaction {
  id: string;
  amount: number;
  description: string;
  type: 'INCOME' | 'EXPENSE';
  categoryId: string;
  category: Category;
  date: string;
}

interface Summary {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
}

export default function Dashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [summary, setSummary] = useState<Summary>({ totalIncome: 0, totalExpenses: 0, balance: 0 });
  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const router = useRouter();

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [categoryId, setCategoryId] = useState('');

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    const token = localStorage.getItem('token');

    const payload = { 
      amount: parseFloat(amount), 
      description, 
      type, 
      categoryId,
      date: editingId ? transactions.find(t => t.id === editingId)?.date : new Date().toISOString()
    };

    try {
      const url = editingId 
        ? `${process.env.NEXT_PUBLIC_API_URL}/transactions/${editingId}`
        : `${process.env.NEXT_PUBLIC_API_URL}/transactions`;
      
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
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

  const filteredCategories = categories.filter(c => c.type === type);

  if (loading) return <div className="premium-container" style={{ textAlign: 'center', marginTop: '20vh', color: 'var(--accent-color)' }}>Initializing Dashboard...</div>;

  return (
    <div className="premium-container" style={{ maxWidth: '1000px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: '800', background: 'linear-gradient(to right, #fff, #888)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Finance Dashboard
        </h1>
        <button onClick={() => router.push('/profile')} className="link-text" style={{ cursor: 'pointer', background: 'none', border: 'none', fontSize: '1rem' }}>View Profile</button>
      </header>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Total Income</p>
          <h2 style={{ fontSize: '2rem', color: 'var(--success-color)' }}>${summary.totalIncome.toFixed(2)}</h2>
        </div>
        <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Total Expenses</p>
          <h2 style={{ fontSize: '2rem', color: 'var(--error-color)' }}>${summary.totalExpenses.toFixed(2)}</h2>
        </div>
        <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center', border: '1px solid var(--accent-color)' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Net Balance</p>
          <h2 style={{ fontSize: '2rem' }}>${summary.balance.toFixed(2)}</h2>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '3rem' }}>
        {/* Add/Edit Transaction Form */}
        <div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>{editingId ? 'Edit' : 'Add'} Transaction</h2>
          <form onSubmit={handleSubmit} className="glass-card" style={{ padding: '2rem' }}>
            <div className="input-group">
              <label>Type</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" onClick={() => { setType('INCOME'); setCategoryId(''); }} style={{ flex: 1, padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: type === 'INCOME' ? 'var(--success-color)' : 'transparent', color: type === 'INCOME' ? '#000' : '#fff', cursor: 'pointer' }}>Income</button>
                <button type="button" onClick={() => { setType('EXPENSE'); setCategoryId(''); }} style={{ flex: 1, padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: type === 'EXPENSE' ? 'var(--error-color)' : 'transparent', color: type === 'EXPENSE' ? '#000' : '#fff', cursor: 'pointer' }}>Expense</button>
              </div>
            </div>

            <div className="input-group">
              <label>Amount ($)</label>
              <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="premium-input" placeholder="0.00" required />
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>* Use negative for refunds in expenses.</p>
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
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="premium-input" placeholder="Monthly rent, Freelance project..." required />
            </div>

            <button type="submit" className="premium-button" disabled={formLoading}>
              {formLoading ? 'Saving...' : (editingId ? 'Update Transaction' : 'Add Transaction')}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="link-text" style={{ width: '100%', marginTop: '1rem', background: 'none', border: 'none', cursor: 'pointer' }}>Cancel Edit</button>
            )}
          </form>
        </div>

        {/* Transaction History */}
        <div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>History</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {transactions.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No transactions yet.</p>}
            {transactions.map((t) => (
              <div key={t.id} className="glass-card fade-in" style={{ padding: '1.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'none' }}>
                <div>
                  <div style={{ fontSize: '1.1rem', fontWeight: '600' }}>{t.description}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.category?.name} • {new Date(t.date).toLocaleDateString()}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: '800', color: t.type === 'INCOME' ? 'var(--success-color)' : (t.amount < 0 ? 'var(--success-color)' : 'var(--error-color)') }}>
                    {t.type === 'INCOME' ? '+' : ''}${t.amount.toFixed(2)}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                    <button onClick={() => handleEdit(t)} style={{ background: 'none', border: 'none', color: 'var(--accent-color)', fontSize: '0.8rem', cursor: 'pointer' }}>Edit</button>
                    <button onClick={() => handleDelete(t.id)} style={{ background: 'none', border: 'none', color: '#ff4d4d', fontSize: '0.8rem', cursor: 'pointer' }}>Delete</button>
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

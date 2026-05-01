'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { ChevronLeft, Download, Calendar, Filter, TrendingUp, TrendingDown, Target } from 'lucide-react';

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

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function Reports() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => currentYear - i);
  }, []);

  const fetchData = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/transactions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch');
      setTransactions(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    });
  }, [transactions, selectedMonth, selectedYear]);

  const reportData = useMemo(() => {
    const income = filteredTransactions.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + t.amount, 0);
    const expense = filteredTransactions.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const savings = income - expense;
    
    const categories: Record<string, number> = {};
    filteredTransactions.filter(t => t.type === 'EXPENSE').forEach(t => {
      const name = t.category?.name || 'Other';
      categories[name] = (categories[name] || 0) + Math.abs(t.amount);
    });

    const categoryBreakdown = Object.entries(categories).map(([name, value]) => ({ name, value }));

    return { income, expense, savings, categoryBreakdown };
  }, [filteredTransactions]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <div className="premium-container" style={{ textAlign: 'center', marginTop: '20vh' }}><div className="loader"></div></div>;

  return (
    <div className="premium-container" style={{ maxWidth: '1000px', paddingBottom: '5rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }} className="no-print">
        <button onClick={() => router.push('/dashboard')} className="link-text" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', cursor: 'pointer' }}>
          <ChevronLeft size={20} /> Back to Dashboard
        </button>
        <button onClick={handlePrint} className="premium-button" style={{ width: 'auto', padding: '0.8rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Download size={20} /> Export Report (PDF)
        </button>
      </header>

      <section id="report-content">
        <div className="glass-card" style={{ padding: '3rem', marginBottom: '3rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4rem' }}>
            <div>
              <h1 style={{ fontSize: '3rem', fontWeight: '800', marginBottom: '0.5rem' }}>Financial Report</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem' }}>Detailed summary for {months[selectedMonth]} {selectedYear}</p>
            </div>
            <div style={{ display: 'flex', gap: '1rem' }} className="no-print">
              <select 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="premium-input"
                style={{ width: '150px' }}
              >
                {months.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
              <select 
                value={selectedYear} 
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="premium-input"
                style={{ width: '120px' }}
              >
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          {/* Quick Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem', marginBottom: '4rem' }}>
            <div style={{ textAlign: 'center', padding: '2rem', background: 'rgba(255,255,255,0.03)', borderRadius: '24px' }}>
              <TrendingUp size={24} color="var(--success-color)" style={{ marginBottom: '1rem' }} />
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textTransform: 'uppercase' }}>Monthly Income</p>
              <h2 style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--success-color)' }}>${reportData.income.toFixed(2)}</h2>
            </div>
            <div style={{ textAlign: 'center', padding: '2rem', background: 'rgba(255,255,255,0.03)', borderRadius: '24px' }}>
              <TrendingDown size={24} color="var(--error-color)" style={{ marginBottom: '1rem' }} />
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textTransform: 'uppercase' }}>Monthly Expenses</p>
              <h2 style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--error-color)' }}>${reportData.expense.toFixed(2)}</h2>
            </div>
            <div style={{ textAlign: 'center', padding: '2rem', background: 'rgba(255,255,255,0.03)', borderRadius: '24px', border: '1px solid var(--accent-color)' }}>
              <Target size={24} color="var(--accent-color)" style={{ marginBottom: '1rem' }} />
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textTransform: 'uppercase' }}>Net Savings</p>
              <h2 style={{ fontSize: '2rem', fontWeight: '800' }}>${reportData.savings.toFixed(2)}</h2>
            </div>
          </div>

          {/* Analysis Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '3rem', marginBottom: '4rem' }}>
            <div>
              <h3 style={{ marginBottom: '2rem' }}>Income vs Expense</h3>
              <div style={{ height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[{ name: months[selectedMonth], income: reportData.income, expense: reportData.expense }]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" stroke="var(--text-muted)" />
                    <YAxis stroke="var(--text-muted)" />
                    <Tooltip contentStyle={{ background: '#111', border: '1px solid #333' }} />
                    <Bar dataKey="income" fill="var(--success-color)" radius={[10, 10, 0, 0]} />
                    <Bar dataKey="expense" fill="var(--error-color)" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div>
              <h3 style={{ marginBottom: '2rem' }}>Expense Breakdown</h3>
              <div style={{ height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={reportData.categoryBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {reportData.categoryBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#111', border: '1px solid #333' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Detailed Table */}
          <div>
            <h3 style={{ marginBottom: '2rem' }}>Transaction Log</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '1rem' }}>Date</th>
                    <th style={{ padding: '1rem' }}>Description</th>
                    <th style={{ padding: '1rem' }}>Category</th>
                    <th style={{ padding: '1rem' }}>Type</th>
                    <th style={{ padding: '1rem', textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map(t => (
                    <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <td style={{ padding: '1rem' }}>{new Date(t.date).toLocaleDateString()}</td>
                      <td style={{ padding: '1rem' }}>{t.description}</td>
                      <td style={{ padding: '1rem' }}>{t.category?.name}</td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ 
                          padding: '0.3rem 0.8rem', 
                          borderRadius: '20px', 
                          fontSize: '0.8rem',
                          background: t.type === 'INCOME' ? 'rgba(0, 255, 136, 0.1)' : 'rgba(255, 77, 77, 0.1)',
                          color: t.type === 'INCOME' ? 'var(--success-color)' : 'var(--error-color)'
                        }}>
                          {t.type}
                        </span>
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '700' }}>
                        {t.type === 'INCOME' ? '+' : ''}${t.amount.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  {filteredTransactions.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No data available for this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <style jsx global>{`
        @media print {
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
          .glass-card { background: white !important; border: none !important; box-shadow: none !important; color: black !important; padding: 0 !important; }
          h1, h2, h3, p, td, th { color: black !important; }
          .premium-container { padding: 0 !important; margin: 0 !important; max-width: 100% !important; }
        }
      `}</style>
    </div>
  );
}

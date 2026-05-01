import Link from 'next/link';

export default function Home() {
  return (
    <div className="premium-container" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', textAlign: 'center' }}>
      <div className="fade-in">
        <h1 style={{ fontSize: '4rem', fontWeight: '900', marginBottom: '1.5rem', background: 'linear-gradient(to bottom right, #fff 30%, #444)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Secure Identity. <br /> Premium Experience.
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem', maxWidth: '600px', margin: '0 auto 3rem', lineHeight: '1.6' }}>
          A state-of-the-art authentication system built with Next.js, Prisma, and MongoDB Atlas.
        </p>

        <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center' }}>
          <Link href="/dashboard" className="premium-button" style={{ width: '180px', textDecoration: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            Go to Dashboard
          </Link>
          <Link href="/profile" className="premium-button" style={{ width: '180px', textDecoration: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'transparent', border: '1px solid var(--border-color)' }}>
            Profile
          </Link>
          <Link href="/login" className="premium-button" style={{ width: '180px', textDecoration: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'transparent', border: '1px solid var(--border-color)' }}>
            Log In
          </Link>
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: '2rem', color: 'var(--text-muted)', fontSize: '0.8rem', letterSpacing: '0.2rem', textTransform: 'uppercase' }}>
        Built with Antigravity AI
      </div>
    </div>
  );
}

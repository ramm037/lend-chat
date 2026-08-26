import { useState } from 'react';
import StarField from './StarField';

function Auth({ onAuth }) {
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    const url = isLogin
      ? 'http://localhost:5000/api/auth/login'
      : 'http://localhost:5000/api/auth/register';

    const body = isLogin
      ? { email: form.email, password: form.password }
      : { username: form.username, email: form.email, password: form.password };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || (data.details && data.details.join(', '))); return; }
      onAuth({ accessToken: data.accessToken, user: data.user });
    } catch (err) {
      setError('Connection failed');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '12px 16px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    backgroundColor: 'var(--surface)',
    color: 'var(--text-h)',
    fontSize: 14,
    fontFamily: 'var(--font-body)',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxSizing: 'border-box'
  };

  return (
    <div style={{
      width: '100vw', height: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'var(--bg)', position: 'relative'
    }}>
      <StarField />

      <div style={{
        position: 'relative', zIndex: 2,
        width: 400, padding: 40,
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        boxShadow: 'var(--shadow)',
        animation: 'fadeInUp 0.5s ease'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            letterSpacing: 4,
            color: 'var(--text-h)',
            textShadow: 'var(--glow-sm)',
            marginBottom: 8
          }}>
            SPACE CHAT
          </h1>
          <p style={{
            fontSize: 13,
            color: 'var(--text-muted)',
            letterSpacing: 2,
            fontFamily: 'var(--font-display)'
          }}>
            {isLogin ? 'ACCESS CONTROL' : 'NEW RECRUIT'}
          </p>
        </div>

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!isLogin && (
            <input
              name="username"
              placeholder="Call Sign"
              value={form.username}
              onChange={handleChange}
              style={inputStyle}
              onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = 'var(--glow-sm)'; }}
              onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
            />
          )}
          <input
            name="email"
            placeholder="Transmission ID (Email)"
            value={form.email}
            onChange={handleChange}
            style={inputStyle}
            onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = 'var(--glow-sm)'; }}
            onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
          />
          <input
            name="password"
            type="password"
            placeholder="Access Code"
            value={form.password}
            onChange={handleChange}
            style={inputStyle}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = 'var(--glow-sm)'; }}
            onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
          />

          {error && (
            <div style={{
              padding: '10px 14px',
              borderRadius: 6,
              backgroundColor: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#ef4444',
              fontSize: 13
            }}>
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              padding: '13px',
              borderRadius: 8,
              border: 'none',
              background: loading
                ? 'var(--border)'
                : 'linear-gradient(135deg, var(--accent), #4c1d95)',
              color: 'white',
              fontFamily: 'var(--font-display)',
              fontSize: 13,
              letterSpacing: 3,
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : 'var(--glow-sm)',
              transition: 'all 0.2s ease'
            }}
          >
            {loading ? 'CONNECTING...' : isLogin ? 'ENGAGE' : 'ENLIST'}
          </button>
        </div>

        {/* Toggle */}
        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: 'var(--text-muted)' }}>
          {isLogin ? 'New to the universe? ' : 'Already enlisted? '}
          <button
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            style={{
              background: 'none', border: 'none',
              color: 'var(--accent-bright)', cursor: 'pointer',
              fontSize: 13, fontWeight: '600'
            }}
          >
            {isLogin ? 'Join the crew' : 'Access station'}
          </button>
        </p>
      </div>
    </div>
  );
}

export default Auth;
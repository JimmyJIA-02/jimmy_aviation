import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

import bg1 from '../assets/ChinaAir.jpg';
import bg2 from '../assets/AirIndia.jpg';

const backgrounds = [bg1, bg2];

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [bgIndex, setBgIndex] = useState(0);
  const { login, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const interval = setInterval(() => {
      setBgIndex((prev) => (prev + 1) % backgrounds.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const result = await login(username, password);
    if (result.success) {
      navigate('/admin');
    } else {
      setError(result.error);
    }
  };

  return (
    <div style={{
      position: 'relative',
      minHeight: '100vh',
      display: 'flex',
      fontFamily: "'DM Sans', sans-serif",
      overflow: 'hidden',
    }}>
      {/* Background slideshow */}
      {backgrounds.map((bg, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${bg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: i === bgIndex ? 1 : 0,
            transition: 'opacity 1.5s ease-in-out',
            zIndex: 0,
          }}
        />
      ))}

      {/* Left stripe — frosted glass */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        width: '40%',
        minWidth: '400px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px',
        backdropFilter: 'blur(8px) saturate(1.2)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.2)',
        backgroundColor: 'rgba(255, 255, 255, 0.65)',
        borderRight: '1px solid rgba(255, 255, 255, 0.3)',
      }}>
        <div style={{
          width: '100%',
          maxWidth: '340px',
        }}>
          <h1 style={{
            fontSize: '28px',
            fontWeight: 700,
            letterSpacing: '-0.5px',
            color: '#1a1a1a',
            marginBottom: '6px',
          }}>SpotterLog</h1>
          <p style={{
            fontSize: '14px',
            color: '#666',
            marginBottom: '36px',
          }}>Sign in to continue</p>

          {error && (
            <div style={{
              background: 'rgba(204, 51, 51, 0.08)',
              color: '#cc3333',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              marginBottom: '20px',
              border: '1px solid rgba(204, 51, 51, 0.15)',
            }}>{error}</div>
          )}

          <label style={labelStyle}>Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter username"
            style={inputStyle}
          />

          <label style={labelStyle}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            style={inputStyle}
          />

          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              background: '#2c2c2c',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.7 : 1,
              marginTop: '8px',
              transition: 'opacity 0.2s',
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </div>
      </div>

      {/* Right side — transparent, shows background */}
      <div style={{
        flex: 1,
        position: 'relative',
        zIndex: 0,
      }} />
    </div>
  );
}

const labelStyle = {
  display: 'block',
  fontSize: '14px',
  fontWeight: 600,
  marginBottom: '8px',
  color: '#1a1a1a',
};

const inputStyle = {
  width: '100%',
  padding: '10px 14px',
  border: '1px solid rgba(0, 0, 0, 0.12)',
  borderRadius: '8px',
  fontSize: '14px',
  marginBottom: '20px',
  boxSizing: 'border-box',
  outline: 'none',
  color: '#333',
  background: 'rgba(255, 255, 255, 0.7)',
};
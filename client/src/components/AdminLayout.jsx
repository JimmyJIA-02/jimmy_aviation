import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AdminLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <nav style={{
        width: '300px',
        background: '#1a1a2e',
        color: '#e0e0e0',
        padding: '40px 0',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'DM Sans', sans-serif",
        flexShrink: 0
      }}>
        <div style={{
          padding: '0 32px 40px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          marginBottom: '20px',
        }}>
          <h1 style={{
            fontSize: '24px',
            fontWeight: 700,
            letterSpacing: '-0.5px',
            margin: 0,
            color: '#fff',
          }}>SpotterLog</h1>
          <span style={{ fontSize: '14px', color: '#888', marginTop: '6px', display: 'block' }}>Admin Panel</span>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', padding: '0 16px' }}>
          {[
            { to: '/admin', label: 'All Spottings', end: true },
            { to: '/admin/new', label: 'New Upload' },
            { to: '/admin/statistics', label: 'Spotting Statistics' }
          ].map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              style={({ isActive }) => ({
                display: 'block',
                padding: '12px 16px',
                borderRadius: '8px',
                color: isActive ? '#fff' : '#aaa',
                background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                textDecoration: 'none',
                fontSize: '16px',
                fontWeight: isActive ? 600 : 400,
                transition: 'all 0.15s',
              })}
            >
              {label}
            </NavLink>
          ))}
        </div>

        <div style={{ padding: '0 16px 8px' }}>
          <NavLink
            to="/admin/planner"
            style={({ isActive }) => ({
              display: 'block',
              padding: '12px 16px',
              borderRadius: '8px',
              color: isActive ? '#fff' : '#aaa',
              background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
              textDecoration: 'none',
              fontSize: '16px',
              fontWeight: isActive ? 600 : 400,
              transition: 'all 0.15s',
              marginBottom: '8px',
            })}
          >
            Spotting Planner
          </NavLink>
        </div>

        <div style={{ padding: '0 16px 8px' }}>
          <NavLink
            to="/"
            style={({ isActive }) => ({
              display: 'block',
              padding: '12px 16px',
              borderRadius: '8px',
              color: isActive ? '#fff' : '#aaa',
              background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
              textDecoration: 'none',
              fontSize: '16px',
              fontWeight: isActive ? 600 : 400,
              transition: 'all 0.15s',
              marginBottom: '8px',
            })}
          >
            Public Gallery
          </NavLink>
        </div>

        <div style={{ padding: '20px 16px', borderTop: '1px solid rgba(255,255,255,0.08)' }}></div>

        <div style={{ padding: '20px 16px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              padding: '12px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: '#aaa',
              cursor: 'pointer',
              fontSize: '15px',
            }}
          >
            Log out
          </button>
        </div>
      </nav>

      <main style={{
        flex: 1,
        background: '#f8f8fa',
        padding: '40px',
        fontFamily: "'DM Sans', sans-serif",
        overflowY: 'auto',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
      }}>
        {/* <div style={{ width: '100%', maxWidth: '800px', paddingTop: '20px' }}>
          <Outlet />
        </div> */}
        <Outlet />
      </main>
    </div>
  );
}
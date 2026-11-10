import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';

export default function Dashboard() {
  const [spottings, setSpottings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState('spotDate');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    fetchSpottings();
  }, []);

  const fetchSpottings = async () => {
    try {
      const res = await api.get('/spotting/all');
      setSpottings(res.data);
    } catch (err) {
      console.error('Failed to fetch spottings', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this spotting?')) return;
    try {
      await api.delete(`/admin/spotting/${id}`);
      setSpottings(spottings.filter(s => s.id !== id));
    } catch (err) {
      console.error('Failed to delete', err);
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const getValue = (spotting, field) => {
    switch (field) {
      case 'spotDate': return spotting.spotDate || '';
      case 'registration': return spotting.registration || '';
      case 'airline': return spotting.airline?.airlineName || '';
      default: return '';
    }
  };

  const sorted = [...spottings].sort((a, b) => {
    const valA = getValue(a, sortField);
    const valB = getValue(b, sortField);
    const cmp = valA.localeCompare(valB);
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const SortHeader = ({ field, label }) => {
    const isActive = sortField === field;
    return (
      <th
        onClick={() => handleSort(field)}
        style={{
          ...thStyle,
          cursor: 'pointer',
          userSelect: 'none',
          color: isActive ? '#1a1a2e' : '#888',
        }}
      >
        {label}
        <span style={{ marginLeft: '4px', fontSize: '10px' }}>
          {isActive ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
        </span>
      </th>
    );
  };

  if (loading) return <p style={{ color: '#888', fontSize: '15px' }}>Loading...</p>;

  return (
    <div style={{ width: '100%' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
      }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, letterSpacing: '-0.3px' }}>
          Spotting Dashboard
        </h2>
      </div>

      {spottings.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          color: '#888',
          background: '#fff',
          borderRadius: '8px',
          border: '1px solid #eee',
        }}>
          <p style={{ fontSize: '16px', marginBottom: '8px' }}>No spottings yet</p>
          <p style={{ fontSize: '14px' }}>Upload your first plane photo to get started.</p>
        </div>
      ) : (
        <div style={{
          background: '#fff',
          borderRadius: '8px',
          border: '1px solid #eee',
          overflow: 'hidden',
        }}>
          {/* Date header */}
          <div style={{
            padding: '12px 20px',
            background: '#fafafa',
            borderBottom: '1px solid #eee',
            fontSize: '14px',
            fontWeight: 600,
            color: '#333',
          }}>
            {new Date().toLocaleDateString('en-AU', { weekday: 'long', month: 'short', day: 'numeric' })}
            <span style={{ color: '#888', fontWeight: 400, marginLeft: '12px' }}>
              {spottings.length} spotting{spottings.length !== 1 ? 's' : ''}
            </span>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #eee' }}>
                <SortHeader field="spotDate" label="Date" />
                <SortHeader field="registration" label="Registration" />
                <th style={thStyle}>Flight</th>
                <th style={thStyle}>From</th>
                <th style={thStyle}>To</th>
                <SortHeader field="airline" label="Airline" />
                <th style={thStyle}>Aircraft</th>
                <th style={thStyle}>Location</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(s => (
                <tr
                  key={s.id}
                  style={{
                    borderBottom: '1px solid #f0f0f0',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#fafafa'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ ...tdStyle, fontVariantNumeric: 'tabular-nums', color: '#666' }}>
                    {s.spotDate || '—'}
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 600, color: '#2a6cb6' }}>
                    {s.registration || '—'}
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 600, color: '#2a6cb6' }}>
                    {s.flight?.flightNumber || '—'}
                  </td>
                  <td style={tdStyle}>
                    {s.flight?.departureAirport || '—'}
                  </td>
                  <td style={tdStyle}>
                    {s.flight?.arrivalAirport || '—'}
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 500 }}>
                    {s.airline?.airlineName || '—'}
                  </td>
                  <td style={tdStyle}>
                    {s.aircraft?.typeName || '—'}
                    {s.registration && (
                      <span style={{ color: '#2a6cb6', fontSize: '12px', marginLeft: '4px' }}>
                        ({s.registration})
                      </span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    {s.spotLocation?.airportName || '—'}
                    {s.spotLocation?.iataCode && (
                      <span style={{ color: '#2a6cb6', fontSize: '12px', marginLeft: '4px' }}>
                        ({s.spotLocation.iataCode})
                      </span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 500,
                      background: '#e8f5e9',
                      color: '#2e7d32',
                    }}>
                      {s.likes ?? 0} ♥
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <Link
                        to={`/admin/edit/${s.id}`}
                        style={{ color: '#2a6cb6', fontSize: '13px', textDecoration: 'none', fontWeight: 500 }}
                      >Edit</Link>
                      <button
                        onClick={() => handleDelete(s.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#cc3333',
                          fontSize: '13px',
                          cursor: 'pointer',
                          padding: 0,
                          fontWeight: 500,
                        }}
                      >Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const thStyle = {
  textAlign: 'left',
  padding: '12px 20px',
  fontWeight: 600,
  fontSize: '12px',
  color: '#888',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  background: '#fafafa',
};

const tdStyle = {
  padding: '12px 20px',
  color: '#333',
};
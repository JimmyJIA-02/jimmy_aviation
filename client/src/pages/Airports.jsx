import { useState, useEffect, useRef } from 'react';
import api from '../api/axios';

export default function Airports() {
  const [airports, setAirports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/admin/airports')
      .then(res => setAirports(res.data))
      .catch(() => setError('Failed to load airports'))
      .finally(() => setLoading(false));
  }, []);

  const replace = (updated) => setAirports(prev => prev.map(a => a.id === updated.id ? updated : a));

  if (loading) return <p style={{ color: '#888', fontSize: '15px' }}>Loading...</p>;

  const withPhoto = airports.filter(a => a.photoUrl).length;

  return (
    <div style={{ width: '100%' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, letterSpacing: '-0.3px' }}>
          Airport Management
        </h2>
        <p style={{ fontSize: '14px', color: '#888', margin: '6px 0 0' }}>
          {airports.length} airport{airports.length !== 1 ? 's' : ''} · {withPhoto} with a photo.
          The photo shows on the airport's card in the logbook; airports without one show a satellite view.
        </p>
      </div>

      {error && (
        <div style={{
          background: '#fff0f0', color: '#cc3333', padding: '10px 14px',
          borderRadius: '6px', fontSize: '13px', marginBottom: '20px',
        }}>{error}</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {airports.map(a => <AirportRow key={a.id} airport={a} onChange={replace} />)}
      </div>
    </div>
  );
}

function AirportRow({ airport, onChange }) {
  const [details, setDetails] = useState({
    airportName: airport.airportName || '',
    city: airport.city || '',
    country: airport.country || '',
  });
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef(null);

  const changed = details.airportName !== (airport.airportName || '')
    || details.city !== (airport.city || '')
    || details.country !== (airport.country || '');

  const run = async (label, action, done) => {
    setBusy(label);
    setMessage(null);
    try {
      const res = await action();
      onChange(res.data);
      setMessage({ ok: true, text: done });
    } catch (err) {
      setMessage({ ok: false, text: err.response?.data?.message || 'Something went wrong' });
    } finally {
      setBusy('');
    }
  };

  const upload = (file) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    run('upload', () => api.post(`/admin/airports/${airport.id}/photo`, formData), 'Photo saved');
  };

  const removePhoto = () => {
    if (!window.confirm(`Remove the photo for ${airport.iataCode}? It will be deleted from storage.`)) return;
    run('remove', () => api.delete(`/admin/airports/${airport.id}/photo`), 'Photo removed');
  };

  const saveDetails = () => run('save', () => api.patch(`/admin/airports/${airport.id}`, details), 'Details saved');

  return (
    <div style={{
      display: 'flex', gap: '20px', alignItems: 'stretch', flexWrap: 'wrap',
      background: '#fff', borderRadius: '8px', border: '1px solid #eee', padding: '16px',
    }}>
      {/* Photo: click or drop to upload */}
      <div
        onClick={() => !busy && fileInput.current.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          upload(e.dataTransfer.files[0]);
        }}
        title={airport.photoUrl ? 'Click or drop a photo to replace it' : 'Click or drop a photo to upload'}
        style={{
          width: '220px', aspectRatio: '16 / 10', flexShrink: 0, borderRadius: '6px', overflow: 'hidden',
          position: 'relative', cursor: busy ? 'wait' : 'pointer',
          border: airport.photoUrl && !dragOver ? '1px solid #eee' : `2px dashed ${dragOver ? '#1a1a2e' : '#ddd'}`,
          background: dragOver ? 'rgba(26,26,46,0.05)' : '#fafafa',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {airport.photoUrl ? (
          <img src={airport.photoUrl} alt={`${airport.iataCode} airport`}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ textAlign: 'center', padding: '0 12px' }}>
            <p style={{ color: '#888', fontSize: '13px', margin: '0 0 4px' }}>Drop a photo here</p>
            <p style={{ color: '#bbb', fontSize: '12px', margin: 0 }}>or click to browse</p>
          </div>
        )}
        {busy === 'upload' && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', color: '#333',
          }}>Uploading...</div>
        )}
        <input ref={fileInput} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={(e) => { upload(e.target.files[0]); e.target.value = ''; }} />
      </div>

      {/* Details */}
      <div style={{ flex: 1, minWidth: '260px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            background: '#1a1a2e', color: '#fff', borderRadius: '6px', padding: '3px 9px',
            fontSize: '13px', fontWeight: 700, letterSpacing: '1.5px',
          }}>{airport.iataCode}</span>
          <span style={{ fontSize: '13px', color: '#888' }}>
            {airport.spottings} spotting{airport.spottings !== 1 ? 's' : ''}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <Field label="Airport name" value={details.airportName}
            onChange={(v) => setDetails({ ...details, airportName: v })} />
          <Field label="City" value={details.city}
            onChange={(v) => setDetails({ ...details, city: v })} />
          <Field label="Country" value={details.country}
            onChange={(v) => setDetails({ ...details, country: v })} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: 'auto', flexWrap: 'wrap' }}>
          <button onClick={saveDetails} disabled={!changed || !!busy} style={{
            ...buttonStyle, background: '#1a1a2e', color: '#fff', border: 'none',
            opacity: !changed || busy ? 0.4 : 1, cursor: !changed || busy ? 'default' : 'pointer',
          }}>
            {busy === 'save' ? 'Saving...' : 'Save details'}
          </button>
          <button onClick={() => fileInput.current.click()} disabled={!!busy} style={buttonStyle}>
            {airport.photoUrl ? 'Replace photo' : 'Upload photo'}
          </button>
          {airport.photoUrl && (
            <button onClick={removePhoto} disabled={!!busy} style={{ ...buttonStyle, color: '#cc3333' }}>
              {busy === 'remove' ? 'Removing...' : 'Remove photo'}
            </button>
          )}
          {message && (
            <span style={{ fontSize: '13px', color: message.ok ? '#2e7d32' : '#cc3333' }}>{message.text}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }) {
  return (
    <label style={{ flex: 1, minWidth: '150px' }}>
      <span style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#888', marginBottom: '4px' }}>
        {label}
      </span>
      <input value={value} onChange={(e) => onChange(e.target.value)} style={{
        width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: '6px',
        fontSize: '14px', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit',
      }} />
    </label>
  );
}

const buttonStyle = {
  padding: '8px 14px', background: '#fff', color: '#333', border: '1px solid #ddd',
  borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
};

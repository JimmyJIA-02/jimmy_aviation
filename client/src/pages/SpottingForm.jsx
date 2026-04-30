import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/axios';

const COUNTRY_ALIASES = {
  'usa': 'United States', 'us': 'United States',
  'uk': 'United Kingdom', 'uae': 'United Arab Emirates',
  'nz': 'New Zealand', 'au': 'Australia',
  'sg': 'Singapore', 'jp': 'Japan',
  'cn': 'China', 'kr': 'South Korea',
  'hk': 'Hong Kong SAR, China', 'tw': 'Taiwan, China',
  'mo': 'Macau SAR, China',
  'america': 'United States', 'united states of america': 'United States',
  'britain': 'United Kingdom', 'great britain': 'United Kingdom',
  'england': 'United Kingdom',
  'hong kong': 'Hong Kong SAR, China', 'hongkong': 'Hong Kong SAR, China',
  'taiwan': 'Taiwan, China',
  'macau': 'Macau SAR, China', 'macao': 'Macau SAR, China',
  'korea': 'South Korea', 'south korea': 'South Korea',
  'emirates': 'United Arab Emirates',
};

function normalizeCountry(value) {
  const lookup = value.trim().toLowerCase();
  return COUNTRY_ALIASES[lookup] || value;
}

export default function SpottingForm() {
  const { id } = useParams();
  const isEditing = !!id;
  const navigate = useNavigate();

  const [form, setForm] = useState({
    registration: '',
    spotDate: '',
    notes: '',
    aircraftIcao: '',
    aircraftTypeName: '',
    airlineIcao: '',
    airlineName: '',
    flightNumber: '',
    departureAirport: '',
    arrivalAirport: '',
    spotLocationIata: '',
    spotLocationName: '',
    spotLocationCity: '',
    spotLocationCountry: '',
  });

  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isEditing) {
      api.get(`/admin/spotting/${id}`).then(res => {
        const s = res.data;
        setForm({
          registration: s.registration || '',
          spotDate: s.spotDate || '',
          notes: s.notes || '',
          aircraftIcao: s.aircraft?.icaoCode || '',
          aircraftTypeName: s.aircraft?.typeName || '',
          airlineIcao: s.airline?.icaoCode || '',
          airlineName: s.airline?.airlineName || '',
          flightNumber: s.flight?.flightNumber || '',
          departureCity: s.flight?.departureAirport || '',
          arrivalCity: s.flight?.arrivalAirport || '',
          spotLocationIata: s.spotLocation?.iataCode || '',
          spotLocationName: s.spotLocation?.airportName || '',
          spotLocationCity: s.spotLocation?.city || '',
          spotLocationCountry: s.spotLocation?.country || '',
        });
        if (s.photoUrl) {
          setPhotoPreview(s.photoUrl.startsWith('/api') ? s.photoUrl : `/api/photo/${s.photoUrl}`);
        }
      }).catch(() => setError('Failed to load spotting'));
    }
  }, [id, isEditing]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleCountryBlur = (e) => {
    const { name, value } = e.target;
    const normalized = normalizeCountry(value);
    if (normalized !== value) {
      setForm({ ...form, [name]: normalized });
    }
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      let photoUrl = null;

      if (photo) {
        const formData = new FormData();
        formData.append('file', photo);
        const uploadRes = await api.post('/admin/photo/upload', formData);
        photoUrl = uploadRes.data.url;
      }

      const body = { ...form };
      if (photoUrl) body.photoUrl = photoUrl;

      if (isEditing) {
        await api.patch(`/admin/spotting/${id}`, body);
      } else {
        if (!photoUrl) {
          setError('Please upload a photo');
          setSaving(false);
          return;
        }
        await api.post('/admin/spotting', body);
      }

      navigate('/admin');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ width: '100%' }}>
      <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '24px', letterSpacing: '-0.3px' }}>
          {isEditing ? 'Edit Spotting' : 'New Upload'}
        </h2>
      <form onSubmit={handleSubmit} style={{
        background: '#fff', borderRadius: '8px', border: '1px solid #eee', padding: '32px',
      }}>

        {error && (
          <div style={{
            background: '#fff0f0', color: '#cc3333', padding: '10px 14px',
            borderRadius: '6px', fontSize: '13px', marginBottom: '20px',
          }}>{error}</div>
        )}

        {/* Photo upload */}
        <div style={{ marginBottom: '24px' }}>
          <label style={labelStyle}>Photo</label>
          <div style={{
            border: '2px dashed #ddd', borderRadius: '8px', padding: '24px',
            textAlign: 'center', cursor: 'pointer',
          }}
            onClick={() => document.getElementById('photo-input').click()}
          >
            {photoPreview ? (
              <img src={photoPreview} alt="Preview" style={{
                maxWidth: '100%', maxHeight: '200px', objectFit: 'contain', borderRadius: '4px',
              }} />
            ) : (
              <p style={{ color: '#888', fontSize: '14px', margin: 0 }}>Click to upload a photo</p>
            )}
            <input
              id="photo-input" type="file" accept="image/*"
              onChange={handlePhotoChange}
              style={{ display: 'none' }}
            />
          </div>
        </div>

        <FieldSection title="Basic Info">
          <FieldRow>
            <Field label="Registration" name="registration" value={form.registration} onChange={handleChange} placeholder="Aircraft Registration" />
            <Field label="Spot Date" name="spotDate" value={form.spotDate} onChange={handleChange} type="date" />
          </FieldRow>
        </FieldSection>

        <FieldSection title="Aircraft">
          <FieldRow>
            <Field label="ICAO Code" name="aircraftIcao" value={form.aircraftIcao} onChange={handleChange} placeholder="Aircraft ICAO Code" />
            <Field label="Serial Number" name="aircraftTypeName" value={form.aircraftTypeName} onChange={handleChange} placeholder="Aircraft Serial Number" />
          </FieldRow>
        </FieldSection>

        <FieldSection title="Airline">
          <FieldRow>
            <Field label="ICAO Code" name="airlineIcao" value={form.airlineIcao} onChange={handleChange} placeholder="Aircraft ICAO Code" />
            <Field label="Name" name="airlineName" value={form.airlineName} onChange={handleChange} placeholder="Aircraft Type Name" />
          </FieldRow>
        </FieldSection>

        <FieldSection title="Flight">
          <FieldRow>
            <Field label="Flight Number" name="flightNumber" value={form.flightNumber} onChange={handleChange} placeholder="QF94" />
          </FieldRow>
          <FieldRow>
            <Field label="Departure" name="departureCity" value={form.departureCity} onChange={handleChange} placeholder="Aircraft Departure City" />
            <Field label="Arrival" name="arrivalCity" value={form.arrivalCity} onChange={handleChange} placeholder="Aircraft Arrival City" />
          </FieldRow>
        </FieldSection>

        <FieldSection title="Spot Location">
          <FieldRow>
            <Field label="IATA" name="spotLocationIata" value={form.spotLocationIata} onChange={handleChange} placeholder="Spot Location Airport IATA" />
            <Field label="Name" name="spotLocationName" value={form.spotLocationName} onChange={handleChange} placeholder="Spot Location Airport Name" />
          </FieldRow>
          <FieldRow>
            <Field label="City" name="spotLocationCity" value={form.spotLocationCity} onChange={handleChange} placeholder="Spot Location City" />
            <Field label="Country" name="spotLocationCountry" value={form.spotLocationCountry} onChange={handleChange} onBlur={handleCountryBlur} placeholder="Spot Location Country" />
          </FieldRow>
        </FieldSection>

        <FieldSection title="Notes">
          <textarea
            name="notes" value={form.notes} onChange={handleChange}
            placeholder="Any notes about this spotting..."
            rows={3}
            style={{
              width: '100%', padding: '10px 12px', border: '1px solid #ddd',
              borderRadius: '6px', fontSize: '14px', resize: 'vertical',
              boxSizing: 'border-box', fontFamily: 'inherit',
            }}
          />
        </FieldSection>

        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
          <button type="submit" disabled={saving} style={{
            padding: '10px 24px', background: '#1a1a2e', color: '#fff',
            border: 'none', borderRadius: '6px', fontSize: '14px',
            fontWeight: 600, cursor: saving ? 'wait' : 'pointer',
            opacity: saving ? 0.7 : 1,
          }}>
            {saving ? 'Saving...' : isEditing ? 'Update' : 'Create'}
          </button>
          <button type="button" onClick={() => navigate('/admin')} style={{
            padding: '10px 24px', background: '#fff', color: '#333',
            border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px',
            cursor: 'pointer',
          }}>Cancel</button>
        </div>
      </form>
    </div>
  );
}

function FieldSection({ title, children }) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <h3 style={{
        fontSize: '13px', fontWeight: 600, color: '#888',
        textTransform: 'uppercase', letterSpacing: '0.5px',
        marginBottom: '12px',
      }}>{title}</h3>
      {children}
    </div>
  );
}

function FieldRow({ children }) {
  return <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>{children}</div>;
}

function Field({ label, name, value, onChange, onBlur, placeholder, type = 'text' }) {
  return (
    <div style={{ flex: 1 }}>
      <label style={labelStyle}>{label}</label>
      <input
        type={type} name={name} value={value} onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '10px 12px', border: '1px solid #ddd',
          borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box',
          outline: 'none',
        }}
      />
    </div>
  );
}

const labelStyle = {
  display: 'block', fontSize: '13px', fontWeight: 500,
  marginBottom: '6px', color: '#333',
};
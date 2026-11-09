import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ExifReader from 'exifreader';
import api from '../api/axios';
import { SPOTTING_TAGS } from '../utils/spottingTags';
import { COUNTRY_OPTIONS } from '../utils/geo';

const tagList = (csv) => (csv || '').split(',').filter(Boolean);

export default function SpottingForm() {
  const [dragOver, setDragOver] = useState(false);
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
    airlineCountry: '',
    flightNumber: '',
    departureAirport: '',
    arrivalAirport: '',
    spotLocationIata: '',
    tags: '', // comma-separated keys, as the server takes them
  });

  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [lookingUp, setLookingUp] = useState(false);

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
          airlineCountry: s.airline?.countryCode || '',
          flightNumber: s.flight?.flightNumber || '',
          departureAirport: s.flight?.departureAirport || '',
          arrivalAirport: s.flight?.arrivalAirport || '',
          spotLocationIata: s.spotLocation?.iataCode || '',
          tags: (s.tags || []).join(','),
        });
        if (s.photoUrl) {
          setPhotoPreview(s.photoUrl.startsWith('/api') ? s.photoUrl : `/api/photo/${s.photoUrl}`);
        }
      }).catch(() => setError('Failed to load spotting'));
    } else {
      // Restore draft
      const draft = sessionStorage.getItem('spottingDraft');
      if (draft) {
        try {
          // over the defaults, so a draft saved before a field existed still fills every field
          setForm(prev => ({ ...prev, ...JSON.parse(draft) }));
        } catch (e) { }
      }
    }
  }, [id, isEditing]);

  const handleRegistrationLookup = async () => {
    if (!form.registration.trim()) return;
    setLookingUp(true);
    try {
      const res = await api.get(`/admin/spotting/autofill/registration/${form.registration.trim()}`);
      const data = res.data;

      if (data.found === false) {
        setError('Registration not found in AeroDataBox');
        return;
      }

      const updates = {};

      if (data.typeName) updates.aircraftTypeName = data.modelCode;
      if (data.icaoCode) updates.aircraftIcao = data.icaoCode;
      if (data.airlineName) updates.airlineName = data.airlineName;

      setForm(prev => {
        const updated = { ...prev, ...updates };
        // AeroDataBox knows freighters, so Cargo can be ticked for you
        if (data.isFreighter && !tagList(prev.tags).includes('cargo')) {
          updated.tags = [...tagList(prev.tags), 'cargo'].join(',');
        }
        sessionStorage.setItem('spottingDraft', JSON.stringify(updated));
        return updated;
      });
    } catch (err) {
      setError('Failed to lookup registration');
    } finally {
      setLookingUp(false);
    }
  };

  const handleChange = (e) => {
    const updated = { ...form, [e.target.name]: e.target.value };
    setForm(updated);
    sessionStorage.setItem('spottingDraft', JSON.stringify(updated));
  };

  const toggleTag = (key) => {
    const tags = tagList(form.tags);
    const next = tags.includes(key) ? tags.filter(t => t !== key) : [...tags, key];
    handleChange({ target: { name: 'tags', value: next.join(',') } });
  };

  // the server looks the airport up by code, so keep it uppercase
  const handleAirportCodeChange = (e) => {
    handleChange({ target: { name: e.target.name, value: e.target.value.toUpperCase() } });
  };

  const handleFileSelect = async (file) => {
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));

    try {
      const tags = await ExifReader.load(file);
      const updates = {};

      if (tags['DateTimeOriginal']) {
        const raw = tags['DateTimeOriginal'].description;
        updates.spotDate = raw.split(' ')[0].replace(/:/g, '-');
      }

      const parts = [];
      const camera = tags['Model']?.description;
      if (camera) parts.push(`Shot on ${camera.trim()}`);
      const lens = tags['LensModel']?.description;
      if (lens) parts.push(lens.trim());
      const focalLength = tags['FocalLength']?.description;
      if (focalLength) parts.push(`${focalLength}mm`);
      const fNumber = tags['FNumber']?.description;
      if (fNumber) parts.push(`f/${fNumber}`);
      const exposure = tags['ExposureTime']?.description;
      if (exposure) parts.push(`${exposure}s`);
      const iso = tags['ISOSpeedRatings']?.description;
      if (iso) parts.push(`ISO ${iso}`);

      if (parts.length > 0) updates.notes = parts.join(' · ');

      setForm(prev => {
        const updated = { ...prev, ...updates };
        sessionStorage.setItem('spottingDraft', JSON.stringify(updated));
        return updated;
      });
    } catch (err) {
      console.log('No EXIF data found', err);
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
      sessionStorage.removeItem('spottingDraft');
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
          <div
            style={{
              border: dragOver ? '2px dashed #1a1a2e' : '2px dashed #ddd',
              borderRadius: '8px',
              padding: '24px',
              textAlign: 'center',
              cursor: 'pointer',
              background: dragOver ? 'rgba(26,26,46,0.05)' : 'transparent',
              transition: 'all 0.2s',
            }}
            onClick={() => document.getElementById('photo-input').click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files[0];
              if (file) handleFileSelect(file);
            }}
          >
            {photoPreview ? (
              <img src={photoPreview} alt="Preview" style={{
                maxWidth: '100%', maxHeight: '200px', objectFit: 'contain', borderRadius: '4px',
              }} />
            ) : (
              <div>
                <p style={{ color: '#888', fontSize: '14px', margin: '0 0 4px' }}>
                  Drag & drop a photo here
                </p>
                <p style={{ color: '#bbb', fontSize: '12px', margin: 0 }}>
                  or click to browse
                </p>
              </div>
            )}
            <input
              id="photo-input" type="file" accept="image/*"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) handleFileSelect(file);
              }}
              style={{ display: 'none' }}
            />
          </div>
        </div>

        <FieldSection title="Basic Info">
          <FieldRow>
            <Field label="Registration" name="registration" value={form.registration} onChange={handleChange} placeholder="VH-OQA" />
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
            <Field label="Name" name="airlineName" value={form.airlineName} onChange={handleChange} placeholder="Airline Name" />
            {/* saved on the airline, so it applies to all of its spottings */}
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Country</label>
              <select name="airlineCountry" value={form.airlineCountry} onChange={handleChange} style={{
                width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: '6px',
                fontSize: '14px', boxSizing: 'border-box', outline: 'none', background: '#fff', fontFamily: 'inherit',
              }}>
                <option value="">{isEditing ? 'Not set' : 'Keep / not set'}</option>
                {COUNTRY_OPTIONS.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </div>
          </FieldRow>
        </FieldSection>

        <FieldSection title="Category">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {SPOTTING_TAGS.map(tag => {
              const on = tagList(form.tags).includes(tag.key);
              return (
                <button key={tag.key} type="button" onClick={() => toggleTag(tag.key)} aria-pressed={on} style={{
                  padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  border: on ? '1px solid #1a1a2e' : '1px solid #ddd',
                  background: on ? '#1a1a2e' : '#fff', color: on ? '#fff' : '#333',
                  transition: 'all 0.15s', fontFamily: 'inherit',
                }}>{tag.icon} {tag.label}</button>
              );
            })}
          </div>
        </FieldSection>

        <FieldSection title="Flight">
          <FieldRow>
            <Field label="Flight Number" name="flightNumber" value={form.flightNumber} onChange={handleChange} placeholder="QF94" />
          </FieldRow>
          <FieldRow>
            <Field label="Departure IATA" name="departureAirport" value={form.departureAirport} onChange={handleAirportCodeChange} placeholder="SIN" />
            <Field label="Arrival IATA" name="arrivalAirport" value={form.arrivalAirport} onChange={handleAirportCodeChange} placeholder="MEL" />
          </FieldRow>
        </FieldSection>

        {/* airports are added in Airport Management; here one is picked by its code */}
        <FieldSection title="Spot Location">
          <FieldRow>
            <Field label="Airport IATA" name="spotLocationIata" value={form.spotLocationIata} onChange={handleAirportCodeChange} placeholder="MEL" />
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
          <button
            type="button"
            onClick={handleRegistrationLookup}
            disabled={lookingUp || !form.registration.trim()}
            style={{
              padding: '10px 16px',
              background: lookingUp ? '#ccc' : '#1a1a2e',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: lookingUp ? 'wait' : 'pointer',
              whiteSpace: 'nowrap',
              opacity: !form.registration.trim() ? 0.5 : 1,
            }}
          >
            {lookingUp ? 'Looking up...' : '🔍 Auto-fill'}
          </button>
          <button type="button" onClick={() => {
            sessionStorage.removeItem('spottingDraft');
            navigate('/admin');
          }} style={{
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


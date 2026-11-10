import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ExifReader from 'exifreader';
import api from '../api/axios';
import { SPOTTING_TAGS } from '../utils/spottingTags';
import CountryInput from '../components/CountryInput';

const tagList = (csv) => (csv || '').split(',').filter(Boolean);

const EMPTY_FORM = {
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
};

// merged over EMPTY_FORM, so a draft saved before a field existed still fills every field
function readDraft() {
  try {
    return JSON.parse(sessionStorage.getItem('spottingDraft')) || {};
  } catch {
    sessionStorage.removeItem('spottingDraft'); // unreadable, so start fresh
    return {};
  }
}

export default function SpottingForm() {
  const [dragOver, setDragOver] = useState(false);
  const { id } = useParams();
  const isEditing = !!id;
  const navigate = useNavigate();

  // a new upload starts from the saved draft, if there is one; an edit is filled in once it loads
  const [form, setForm] = useState(() => isEditing ? EMPTY_FORM : { ...EMPTY_FORM, ...readDraft() });

  // new photos, each { file, preview }; a new upload can take several, an edit replaces with one
  const [photos, setPhotos] = useState([]);
  const [existingPhoto, setExistingPhoto] = useState(null);
  const [progress, setProgress] = useState(null); // { done, total } while saving several
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [lookingUp, setLookingUp] = useState(false);

  useEffect(() => {
    if (!isEditing) return;
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
        setExistingPhoto(s.photoUrl.startsWith('/api') ? s.photoUrl : `/api/photo/${s.photoUrl}`);
      }
    }).catch(() => setError('Failed to load spotting'));
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
    } catch {
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

  // dropped or picked files; the same file twice is ignored. Date and notes come from the first photo
  const addFiles = (fileList) => {
    const images = [...fileList].filter(f => f.type.startsWith('image/'));
    const fileKey = (f) => `${f.name}|${f.size}|${f.lastModified}`;
    const seen = new Set(isEditing ? [] : photos.map(p => fileKey(p.file)));
    const added = (isEditing ? images.slice(0, 1) : images)
      .filter(f => !seen.has(fileKey(f)))
      .map(file => ({ file, preview: URL.createObjectURL(file) }));
    if (!added.length) return;

    const first = isEditing || photos.length === 0;
    if (isEditing) photos.forEach(p => URL.revokeObjectURL(p.preview));
    setPhotos(isEditing ? added : [...photos, ...added]);
    if (first) readExif(added[0].file);
  };

  const removePhoto = (index) => {
    URL.revokeObjectURL(photos[index].preview);
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const readExif = async (file) => {
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

    const uploadPhoto = async (file) => {
      const formData = new FormData();
      formData.append('file', file);
      return (await api.post('/admin/photo/upload', formData)).data.url;
    };

    if (isEditing) {
      try {
        const body = { ...form };
        if (photos[0]) body.photoUrl = await uploadPhoto(photos[0].file);
        await api.patch(`/admin/spotting/${id}`, body);
        navigate('/admin');
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to save');
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!photos.length) {
      setError('Please upload a photo');
      setSaving(false);
      return;
    }

    // one spotting per photo, all with the details above, one after another
    let saved = 0;
    try {
      for (const p of photos) {
        setProgress({ done: saved, total: photos.length });
        const photoUrl = await uploadPhoto(p.file);
        await api.post('/admin/spotting', { ...form, photoUrl });
        saved++;
      }
      sessionStorage.removeItem('spottingDraft');
      navigate('/admin');
    } catch (err) {
      // keep only the photos not yet saved, so pressing Create again doesn't make duplicates
      photos.slice(0, saved).forEach(p => URL.revokeObjectURL(p.preview));
      const message = err.response?.data?.message || 'Failed to save';
      setPhotos(photos.slice(saved));
      setError(saved
        ? `${saved} of ${photos.length} saved, then: ${message}. Press Create to retry the remaining ${photos.length - saved}.`
        : message);
    } finally {
      setSaving(false);
      setProgress(null);
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
          <label style={labelStyle}>
            {isEditing ? 'Photo' : 'Photos'}
            {photos.length > 1 && (
              <span style={{ color: '#888', fontWeight: 400 }}> · {photos.length} photos, one spotting each</span>
            )}
          </label>
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
            onClick={() => !saving && document.getElementById('photo-input').click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (!saving) addFiles(e.dataTransfer.files);
            }}
          >
            {isEditing ? (
              (photos[0]?.preview || existingPhoto) ? (
                <img src={photos[0]?.preview || existingPhoto} alt="Preview" style={{
                  maxWidth: '100%', maxHeight: '200px', objectFit: 'contain', borderRadius: '4px',
                }} />
              ) : <DropHint text="Drag & drop a photo here" />
            ) : photos.length ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
                {photos.map((p, i) => (
                  <div key={p.preview} style={{ position: 'relative', height: '120px' }}>
                    <img src={p.preview} alt={`Photo ${i + 1}`} style={{
                      height: '100%', maxWidth: '200px', objectFit: 'cover', borderRadius: '4px', display: 'block',
                    }} />
                    {!saving && (
                      <button type="button" aria-label={`Remove photo ${i + 1}`}
                        onClick={(e) => { e.stopPropagation(); removePhoto(i); }}
                        style={{
                          position: 'absolute', top: '4px', right: '4px', width: '22px', height: '22px',
                          borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff',
                          fontSize: '14px', lineHeight: '22px', padding: 0, cursor: 'pointer',
                        }}>×</button>
                    )}
                  </div>
                ))}
                <div style={{
                  height: '120px', width: '120px', borderRadius: '4px', border: '1px dashed #ccc',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#888', fontSize: '13px',
                }}>+ Add more</div>
              </div>
            ) : (
              <DropHint text="Drag & drop photos here" sub="or click to browse · several photos make one spotting each" />
            )}
            <input
              id="photo-input" type="file" accept="image/*" multiple={!isEditing}
              onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
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
              <CountryInput
                value={form.airlineCountry}
                onChange={(code) => handleChange({ target: { name: 'airlineCountry', value: code } })}
                placeholder="Type a country"
                style={{
                  width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: '6px',
                  fontSize: '14px', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit',
                }}
              />
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
            {saving
              ? (progress && progress.total > 1 ? `Saving ${progress.done + 1} of ${progress.total}...` : 'Saving...')
              : isEditing ? 'Update' : photos.length > 1 ? `Create ${photos.length} spottings` : 'Create'}
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

function DropHint({ text, sub = 'or click to browse' }) {
  return (
    <div>
      <p style={{ color: '#888', fontSize: '14px', margin: '0 0 4px' }}>{text}</p>
      <p style={{ color: '#bbb', fontSize: '12px', margin: 0 }}>{sub}</p>
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


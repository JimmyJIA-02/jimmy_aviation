import { useState, useEffect, useMemo } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import api from '../api/axios';

const NAVY = '#1a1a2e';
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const MAP_W = 400, MAP_H = 300;
const SAT_ZOOM = 13;
const SAT_ATTRIBUTION = 'Satellite imagery: Esri, Maxar, Earthstar Geographics';

// Country names as typed in the admin form / AeroDataBox -> names in the world outline data
const MAP_NAMES = {
    'United States': 'United States of America',
    'Hong Kong SAR, China': 'Hong Kong',
    'Macau SAR, China': 'Macao',
    'Macau': 'Macao',
    'Taiwan, China': 'Taiwan',
    'Korea, Republic of': 'South Korea',
    'Viet Nam': 'Vietnam',
    'Türkiye': 'Turkey',
    'Czech Republic': 'Czechia',
    'Russian Federation': 'Russia',
};
const mapName = (name) => MAP_NAMES[name] || name;

const CameraIcon = ({ size }) => (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
    </svg>
);

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
// AeroDataBox country code -> flag shown; Taiwan uses the China flag
const FLAG_OVERRIDES = { TW: 'CN' };
const flagUrl = (code) => {
    const flag = FLAG_OVERRIDES[code.toUpperCase()] || code;
    return `https://cdn.jsdelivr.net/npm/flag-icons@7.2.3/flags/4x3/${flag.toLowerCase()}.svg`;
};

function formatDate(iso) {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${d} ${MONTHS[Number(m) - 1]} ${y}`;
}

function useIsMobile() {
    const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 640);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return isMobile;
}

// The main landmasses only (anything at least 0.5% of the largest piece), so remote islands
// don't shrink the whole map. The full outline is still drawn.
function mainland(feature) {
    if (feature.geometry.type !== 'MultiPolygon') return feature;
    const parts = feature.geometry.coordinates;
    const areas = parts.map(coordinates => d3.geoArea({ type: 'Polygon', coordinates }));
    const largest = Math.max(...areas);
    return {
        type: 'Feature',
        properties: feature.properties,
        geometry: { type: 'MultiPolygon', coordinates: parts.filter((_, i) => areas[i] >= largest * 0.005) },
    };
}

// Country outlines. The detailed file (3.6 MB) is only fetched when a small country such as
// Singapore or Hong Kong is in the list, where the regular outline is too coarse.
const SMALL_COUNTRY_AREA = 2e-4; // steradians
function useCountryShapes(names) {
    const [shapes, setShapes] = useState(null);
    const key = names.join('|');

    useEffect(() => {
        if (!key) return;
        let cancelled = false;
        const load = async (file) => {
            const world = await (await fetch(file)).json();
            const features = topojson.feature(world, world.objects.countries).features;
            return new Map(features.map(f => [f.properties.name, f]));
        };
        (async () => {
            try {
                let byName = await load('/world-50m.json');
                const wanted = key.split('|').map(n => byName.get(n)).filter(Boolean);
                if (wanted.some(f => d3.geoArea(mainland(f)) < SMALL_COUNTRY_AREA)) {
                    byName = await load('/world-10m.json');
                }
                if (!cancelled) setShapes(byName);
            } catch (err) {
                console.error('Country outlines failed to load', err);
            }
        })();
        return () => { cancelled = true; };
    }, [key]);

    return shapes;
}

// ───────── country card: the country's own outline with a pin for each airport ─────────

function CountryMap({ feature, airports, showLabels }) {
    const drawing = useMemo(() => {
        const extent = [[30, 52], [MAP_W - 30, MAP_H - 108]]; // bottom kept clear for the name
        const main = mainland(feature);
        const projection = feature.properties.name === 'United States of America'
            ? d3.geoAlbersUsa().fitExtent(extent, feature)
            : d3.geoMercator().rotate([-d3.geoCentroid(main)[0], 0]).fitExtent(extent, main);
        const pins = airports
            .filter(a => a.lat != null && a.lon != null)
            .map(a => ({ iata: a.iata, point: projection([a.lon, a.lat]) }))
            .filter(p => p.point);
        return { d: d3.geoPath(projection)(feature), pins };
    }, [feature, airports]);

    return (
        <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
            <path d={drawing.d} fill="rgba(120,160,230,0.16)" stroke="#9cbcff" strokeWidth={1.2}
                strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            {drawing.pins.map(({ iata, point: [x, y] }) => (
                <g key={iata}>
                    <circle cx={x} cy={y} r={9} fill="rgba(255,255,255,0.18)" />
                    <circle cx={x} cy={y} r={4} fill="#fff" stroke="#0b1426" strokeWidth={1.5} />
                    {showLabels && (
                        <text x={x + 9} y={y + 3} fill="#fff" stroke="#0b1426" strokeWidth={3} paintOrder="stroke"
                            style={{ font: "700 9px 'DM Sans', sans-serif", letterSpacing: '0.8px' }}>{iata}</text>
                    )}
                </g>
            ))}
        </svg>
    );
}

function CountryCard({ country, feature, isMobile, onOpen }) {
    const [hovered, setHovered] = useState(false);

    return (
        <button
            onClick={onOpen}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            aria-label={`${country.name}, ${plural(country.airports.length, 'airport')}, ${plural(country.count, 'photo')}`}
            style={{
                position: 'relative', aspectRatio: isMobile ? '3 / 4' : '4 / 3', borderRadius: '14px', overflow: 'hidden',
                border: 0, padding: 0, textAlign: 'left', color: '#fff', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                background: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,.07) 1px, transparent 0) 0 0 / 14px 14px, '
                    + 'linear-gradient(160deg, #13223d 0%, #0b1426 100%)',
                boxShadow: hovered ? '0 10px 26px rgba(0,0,0,.18)' : '0 4px 14px rgba(0,0,0,.08)',
                transform: hovered ? 'translateY(-3px)' : 'none',
                transition: 'transform .2s, box-shadow .2s',
            }}
        >
            {feature && <CountryMap feature={feature} airports={country.airports} showLabels={!isMobile} />}
            {country.countryCode && (
                <img src={flagUrl(country.countryCode)} alt="" style={{
                    position: 'absolute', top: isMobile ? '10px' : '14px', left: isMobile ? '10px' : '14px',
                    width: isMobile ? '32px' : '40px', height: isMobile ? '24px' : '30px', borderRadius: '5px',
                    boxShadow: '0 2px 8px rgba(0,0,0,.35), 0 0 0 1px rgba(255,255,255,.4)',
                }} />
            )}
            <span style={{
                position: 'absolute', top: isMobile ? '10px' : '14px', right: isMobile ? '10px' : '14px',
                display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(255,255,255,.92)', color: NAVY,
                borderRadius: '999px', padding: '4px 10px 4px 8px', fontSize: '12px', fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
            }}>
                <CameraIcon size={14} />{country.count}
            </span>
            <span style={{ position: 'absolute', left: isMobile ? '12px' : '16px', right: isMobile ? '12px' : '16px', bottom: isMobile ? '11px' : '14px' }}>
                <span style={{ display: 'block', fontSize: isMobile ? '17px' : '22px', fontWeight: 800, letterSpacing: '-0.4px', lineHeight: 1.15 }}>
                    {country.name}
                </span>
                <span style={{ display: 'block', fontSize: '13px', opacity: 0.8, marginTop: '3px' }}>
                    {plural(country.airports.length, 'airport')}
                </span>
            </span>
        </button>
    );
}

// ───────── airport card: your photo, or a satellite view until there is one ─────────

// 3×3 satellite tiles positioned so the airport sits in the middle of the card
function SatelliteView({ lat, lon, zoomed }) {
    const n = 2 ** SAT_ZOOM;
    const x = (lon + 180) / 360 * n * 256;
    const rad = lat * Math.PI / 180;
    const y = (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * n * 256;
    const tx = Math.floor(x / 256), ty = Math.floor(y / 256);
    const tiles = [];
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            tiles.push({ col: tx + dx, row: ty + dy, left: (tx + dx) * 256 - x, top: (ty + dy) * 256 - y });
        }
    }
    return (
        <div title={SAT_ATTRIBUTION} style={{
            position: 'absolute', inset: 0, transform: zoomed ? 'scale(1.05)' : 'none', transition: 'transform .5s ease',
        }}>
            {tiles.map(t => (
                <img key={`${t.col}-${t.row}`} alt="" loading="lazy"
                    src={`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${SAT_ZOOM}/${t.row}/${t.col}`}
                    style={{
                        position: 'absolute', width: '256px', height: '256px',
                        left: `calc(50% + ${t.left}px)`, top: `calc(50% + ${t.top}px)`,
                    }} />
            ))}
        </div>
    );
}

function AirportCard({ airport, onOpen }) {
    const [hovered, setHovered] = useState(false);
    const showCity = airport.city && !(airport.name || '').includes(airport.city);

    return (
        <button
            onClick={onOpen}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                display: 'flex', flexDirection: 'column', border: '1px solid #eee', borderRadius: '14px', overflow: 'hidden',
                background: '#fff', cursor: 'pointer', textAlign: 'left', padding: 0, color: 'inherit',
                fontFamily: "'DM Sans', sans-serif",
                transform: hovered ? 'translateY(-3px)' : 'none',
                boxShadow: hovered ? '0 10px 24px rgba(0,0,0,.09)' : 'none',
                transition: 'transform .2s, box-shadow .2s',
            }}
        >
            <div style={{ position: 'relative', aspectRatio: '16 / 10', overflow: 'hidden', background: '#2b3440', width: '100%' }}>
                {airport.photoUrl ? (
                    <img src={airport.photoUrl} alt={airport.name} loading="lazy" style={{
                        width: '100%', height: '100%', objectFit: 'cover', display: 'block',
                        transform: hovered ? 'scale(1.05)' : 'none', transition: 'transform .5s ease',
                    }} />
                ) : airport.lat != null && airport.lon != null ? (
                    <SatelliteView lat={airport.lat} lon={airport.lon} zoomed={hovered} />
                ) : null}
                <span style={{
                    position: 'absolute', top: '12px', left: '12px', background: NAVY, color: '#fff', borderRadius: '6px',
                    padding: '4px 9px', fontSize: '13px', fontWeight: 800, letterSpacing: '1.5px',
                }}>{airport.iata}</span>
                <span style={{
                    position: 'absolute', right: '12px', bottom: '12px', display: 'flex', alignItems: 'center', gap: '6px',
                    background: 'rgba(255,255,255,.94)', color: NAVY, borderRadius: '999px', padding: '5px 12px 5px 10px',
                    fontSize: '13px', fontWeight: 700, boxShadow: '0 2px 8px rgba(0,0,0,.15)', fontVariantNumeric: 'tabular-nums',
                }}>
                    <CameraIcon size={15} />{plural(airport.count, 'photo')}
                </span>
            </div>
            <div style={{ padding: '12px 14px 14px', width: '100%', boxSizing: 'border-box' }}>
                <div style={{ fontSize: '16px', fontWeight: 700, lineHeight: 1.25, color: NAVY }}>{airport.name}</div>
                {showCity && <div style={{ fontSize: '13px', color: '#777', marginTop: '2px' }}>{airport.city}</div>}
                <div style={{ display: 'flex', gap: '16px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #f2f2f2' }}>
                    {[['First Visit', airport.firstVisit], ['Latest Update', airport.lastVisit]].map(([label, date]) => (
                        <div key={label} style={{ fontSize: '12px', color: '#666' }}>
                            <small style={{
                                display: 'block', fontSize: '10px', letterSpacing: '1.2px', textTransform: 'uppercase',
                                color: '#aaa', fontWeight: 700, marginBottom: '1px',
                            }}>{label}</small>
                            {formatDate(date)}
                        </div>
                    ))}
                </div>
            </div>
        </button>
    );
}

// ───────── section ─────────

export default function SpottingLocations({ onOpenAirport }) {
    const isMobile = useIsMobile();
    const [locations, setLocations] = useState(null);
    const [selected, setSelected] = useState(null);

    useEffect(() => {
        api.get('/locations')
            .then(res => setLocations(res.data))
            .catch(err => {
                console.error('Failed to load spotting locations', err);
                setLocations([]);
            });
    }, []);

    // countries in the admin's own naming, busiest first; airports busiest first
    const countries = useMemo(() => [...d3.group(locations || [], l => l.country || 'Unknown')]
        .map(([name, airports]) => ({
            name,
            airports: [...airports].sort((a, b) => b.count - a.count),
            count: d3.sum(airports, a => a.count),
            countryCode: airports.find(a => a.countryCode)?.countryCode,
            mapNames: [...new Set(airports.flatMap(a => [mapName(name), a.mapName && mapName(a.mapName)]).filter(Boolean))],
        }))
        .sort((a, b) => b.count - a.count), [locations]);

    const shapeNames = useMemo(() => [...new Set(countries.flatMap(c => c.mapNames))].sort(), [countries]);
    const shapes = useCountryShapes(shapeNames);
    const shapeOf = (country) => country.mapNames.map(n => shapes?.get(n)).find(Boolean);

    useEffect(() => {
        if (!selected) return;
        const onKey = (e) => { if (e.key === 'Escape') setSelected(null); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [selected]);

    if (locations === null) {
        return <p style={{ color: '#888', fontSize: '14px', marginBottom: '32px' }}>Loading locations...</p>;
    }
    if (!locations.length) return null;

    const country = selected && countries.find(c => c.name === selected);
    const totalPhotos = d3.sum(locations, l => l.count);
    const usesSatellite = country && country.airports.some(a => !a.photoUrl && a.lat != null);
    const summaryStyle = { fontSize: '13px', color: '#777', margin: '0 0 16px' };
    const strong = { color: NAVY, fontVariantNumeric: 'tabular-nums' };

    return (
        <div style={{ marginBottom: '32px' }}>
            {!country ? (
                <>
                    <p style={summaryStyle}>
                        <b style={strong}>{countries.length}</b> {countries.length === 1 ? 'country' : 'countries'}
                        {' · '}<b style={strong}>{locations.length}</b> {locations.length === 1 ? 'airport' : 'airports'}
                        {' · '}<b style={strong}>{totalPhotos}</b> {totalPhotos === 1 ? 'photo' : 'photos'}
                    </p>
                    <div style={{
                        display: 'grid', gap: isMobile ? '10px' : '16px',
                        gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fill, minmax(250px, 1fr))',
                    }}>
                        {countries.map(c => (
                            <CountryCard key={c.name} country={c} feature={shapeOf(c)} isMobile={isMobile}
                                onOpen={() => setSelected(c.name)} />
                        ))}
                    </div>
                </>
            ) : (
                <>
                    <p style={summaryStyle}>
                        <b style={strong}>{country.airports.length}</b> {country.airports.length === 1 ? 'airport' : 'airports'}
                        {' · '}<b style={strong}>{country.count}</b> {country.count === 1 ? 'photo' : 'photos'}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                        <button onClick={() => setSelected(null)} style={{
                            display: 'inline-flex', alignItems: 'center', height: '34px', padding: '0 14px 0 10px',
                            border: '1px solid #e5e7eb', borderRadius: '999px', background: '#fff', cursor: 'pointer',
                            fontSize: '13px', fontWeight: 600, color: NAVY, fontFamily: "'DM Sans', sans-serif",
                        }}>← All countries</button>
                        {country.countryCode && (
                            <img src={flagUrl(country.countryCode)} alt="" style={{
                                width: '24px', height: '18px', borderRadius: '3px', boxShadow: '0 0 0 1px rgba(0,0,0,.08)',
                            }} />
                        )}
                        <span style={{ fontSize: '15px', fontWeight: 700 }}>{country.name}</span>
                    </div>
                    <div style={{
                        display: 'grid', gap: '16px',
                        gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(260px, 1fr))',
                    }}>
                        {country.airports.map(a => (
                            <AirportCard key={a.iata} airport={a} onOpen={() => onOpenAirport?.(a.iata)} />
                        ))}
                    </div>
                    {usesSatellite && (
                        <p style={{ fontSize: '11px', color: '#aaa', margin: '10px 0 0' }}>{SAT_ATTRIBUTION}</p>
                    )}
                </>
            )}
        </div>
    );
}

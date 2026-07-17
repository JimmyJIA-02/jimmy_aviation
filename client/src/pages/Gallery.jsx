import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import aboutContent from '../assets/about.md?raw';
import { MapContainer, TileLayer, Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';


import api from '../api/axios';

const TABS = [
    { key: 'gallery', label: 'GALLERY' },
    { key: 'logbook', label: 'LOGBOOK' },
    { key: 'about', label: 'ABOUT ME' },
];

const coordsCache = {};

const LUNAR_ANIMALS = ['🐉', '🐍', '🐎', '🐑', '🐒', '🐓', '🐕', '🐖', '🐀', '🐂', '🐅', '🐇'];

const getLunarAnimal = (year) => LUNAR_ANIMALS[(year - 2024) % 12];

function SpottingMap({ locations }) {
    const [resolvedLocations, setResolvedLocations] = useState([]);

    useEffect(() => {
        const resolve = async () => {
            const results = [];
            for (const loc of locations) {
                const coords = await geocodeCity(loc.city || loc.name);
                if (coords) {
                    results.push({ ...loc, coords });
                }
            }
            setResolvedLocations(results);
        };
        resolve();
    }, [locations]);

    if (resolvedLocations.length === 0) return null;

    const center = [resolvedLocations[0].coords.lat, resolvedLocations[0].coords.lng];
    const maxCount = Math.max(...resolvedLocations.map(l => l.count));

    return (
        <div style={{
            borderRadius: '12px',
            overflow: 'hidden',
            border: '1px solid #eee',
            marginBottom: '32px',
        }}>
            <MapContainer
                center={center}
                zoom={4}
                style={{ height: '360px', width: '100%' }}
                scrollWheelZoom={false}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {resolvedLocations.map(loc => {
                    const size = 24 + (loc.count / maxCount) * 40;

                    const icon = L.divIcon({
                        className: '',
                        html: `<div style="
                            width: ${size}px;
                            height: ${size}px;
                            border-radius: 50%;
                            background: #1a1a2e;
                            opacity: 0.85;
                            color: #fff;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-size: ${size > 40 ? 14 : 12}px;
                            font-weight: 700;
                            font-family: 'DM Sans', sans-serif;
                            border: 2px solid #fff;
                            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                        ">${loc.count}</div>`,
                        iconSize: [size, size],
                        iconAnchor: [size / 2, size / 2],
                    });

                    return (
                        <Marker
                            key={loc.iata}
                            position={[loc.coords.lat, loc.coords.lng]}
                            icon={icon}
                        >
                            <Tooltip direction="top" offset={[0, -size / 2]}>
                                <div style={{ fontFamily: "'DM Sans', sans-serif", textAlign: 'center' }}>
                                    <strong>{loc.name} ({loc.iata})</strong>
                                </div>
                            </Tooltip>
                        </Marker>
                    );
                })}
            </MapContainer>
        </div>
    );
}

async function geocodeCity(cityName) {
    if (coordsCache[cityName]) return coordsCache[cityName];

    // Check localStorage cache
    const cached = localStorage.getItem(`geo_${cityName}`);
    if (cached) {
        const parsed = JSON.parse(cached);
        coordsCache[cityName] = parsed;
        return parsed;
    }

    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cityName + ' airport')}&format=json&limit=1`
        );
        const data = await res.json();

        if (data.length > 0) {
            const coords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
            coordsCache[cityName] = coords;
            localStorage.setItem(`geo_${cityName}`, JSON.stringify(coords));
            return coords;
        }
    } catch (err) {
        console.error('Geocode failed for', cityName, err);
    }

    return null;
}

function RouteMap({ spottings }) {
    const containerRef = useRef(null);
    const [routes, setRoutes] = useState([]);
    const [cities, setCities] = useState({});
    const [popup, setPopup] = useState(null);
    const [dimensions, setDimensions] = useState({ width: 900, height: 420 });

    useEffect(() => {
        if (containerRef.current) {
            setDimensions({
                width: containerRef.current.clientWidth,
                height: 420,
            });
        }
    }, []);

    useEffect(() => {
        const resolve = async () => {
            const routeMap = {};
            spottings.forEach(s => {
                if (!s.flight?.departureAirport || !s.flight?.arrivalAirport) return;
                const dep = s.flight.departureAirport;
                const arr = s.flight.arrivalAirport;
                const key = [dep, arr].sort().join(' ↔ ');
                if (!routeMap[key]) {
                    routeMap[key] = { from: dep, to: arr, count: 0, flights: [] };
                }
                routeMap[key].count++;
                routeMap[key].flights.push({
                    flightNumber: s.flight.flightNumber,
                    aircraft: s.aircraft?.icaoCode || '—',
                    airline: s.airline?.airlineName || '—',
                    registration: s.registration || '—',
                    date: s.spotDate || '—',
                });
            });

            const resolvedRoutes = [];
            const resolvedCities = {};

            for (const route of Object.values(routeMap)) {
                const fromCoords = await geocodeCity(route.from);
                const toCoords = await geocodeCity(route.to);
                if (fromCoords && toCoords) {
                    resolvedRoutes.push({ ...route, fromCoords, toCoords });
                    resolvedCities[route.from] = fromCoords;
                    resolvedCities[route.to] = toCoords;
                }
            }

            setRoutes(resolvedRoutes);
            setCities(resolvedCities);
        };
        resolve();
    }, [spottings]);

    const svgContent = useMemo(() => {
        if (routes.length === 0 || dimensions.width === 0) return null;

        const { width, height } = dimensions;

        const projection = d3.geoNaturalEarth1()
            .rotate([-150, 0])
            .fitSize([width, height], { type: 'Sphere' });

        const path = d3.geoPath().projection(projection);
        const maxCount = Math.max(...routes.map(r => r.count));

        const sphere = path({ type: 'Sphere' });
        const graticule = path(d3.geoGraticule10());

        const routePaths = routes.map((route, i) => {
            const line = {
                type: 'LineString',
                coordinates: [
                    [route.fromCoords.lng, route.fromCoords.lat],
                    [route.toCoords.lng, route.toCoords.lat],
                ],
            };
            const weight = 1.5 + (route.count / maxCount) * 2.5;
            return {
                d: path(line),
                weight,
                route,
                index: i,
            };
        });

        const cityMarkers = Object.entries(cities).map(([name, coords]) => {
            const projected = projection([coords.lng, coords.lat]);
            if (!projected) return null;
            return { name, x: projected[0], y: projected[1] };
        }).filter(Boolean);

        return { sphere, graticule, routePaths, cityMarkers };
    }, [routes, cities, dimensions]);

    if (routes.length === 0) return null;

    return (
        <div
            ref={containerRef}
            style={{
                borderRadius: '12px',
                overflow: 'hidden',
                border: '1px solid #eee',
                marginBottom: '32px',
                position: 'relative',
            }}
        >
            <svg
                viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
                style={{ width: '100%', height: '420px', display: 'block', background: '#e8f0f8' }}
            >
                {svgContent && (
                    <>
                        {/* Ocean */}
                        <path d={svgContent.sphere} fill="#e8f0f8" stroke="#ccc" />

                        {/* Graticule */}
                        <path d={svgContent.graticule} fill="none" stroke="#ddd" strokeWidth={0.3} />

                        {/* Countries — loaded via fetch */}
                        <CountryPaths dimensions={dimensions} />

                        {/* Routes */}
                        {svgContent.routePaths.map((r, i) => (
                            <path
                                key={i}
                                d={r.d}
                                fill="none"
                                stroke="#1a1a2e"
                                strokeWidth={r.weight}
                                strokeOpacity={0.5}
                                strokeDasharray="6 3"
                                strokeLinecap="round"
                                style={{ cursor: 'pointer' }}
                                onClick={() => setPopup({ route: r.route })}
                                onMouseEnter={(e) => {
                                    e.target.setAttribute('stroke-opacity', '0.9');
                                    e.target.setAttribute('stroke-width', r.weight + 1);
                                }}
                                onMouseLeave={(e) => {
                                    e.target.setAttribute('stroke-opacity', '0.5');
                                    e.target.setAttribute('stroke-width', r.weight);
                                }}
                            >
                                <title>{r.route.from} ↔ {r.route.to} · {r.route.count} spotting{r.route.count !== 1 ? 's' : ''}</title>
                            </path>
                        ))}

                        {/* City dots and labels */}
                        {svgContent.cityMarkers.map((c) => (
                            <g key={c.name}>
                                <circle cx={c.x} cy={c.y} r={4} fill="#1a1a2e" stroke="#fff" strokeWidth={1.5} />
                                <text
                                    x={c.x}
                                    y={c.y - 10}
                                    textAnchor="middle"
                                    style={{
                                        fontFamily: "'DM Sans', sans-serif",
                                        fontSize: '10px',
                                        fill: '#555',
                                        fontWeight: 600,
                                    }}
                                >
                                    {c.name}
                                </text>
                            </g>
                        ))}
                    </>
                )}
            </svg>

            {/* Popup */}
            {popup && (
                <>
                    <div
                        style={{ position: 'fixed', inset: 0, zIndex: 999 }}
                        onClick={() => setPopup(null)}
                    />
                    <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        background: '#fff',
                        borderRadius: '10px',
                        border: '1px solid #eee',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                        padding: '16px',
                        width: '320px',
                        zIndex: 1000,
                        fontFamily: "'DM Sans', sans-serif",
                    }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '12px',
                            paddingBottom: '8px',
                            borderBottom: '1px solid #eee',
                        }}>
                            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>
                                {popup.route.from} ↔ {popup.route.to}
                            </h3>
                            <button
                                onClick={() => setPopup(null)}
                                style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    fontSize: '16px', color: '#888', padding: '0 4px',
                                }}
                            >✕</button>
                        </div>
                        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                            {popup.route.flights.map((f, j) => (
                                <div key={j} style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '6px 0',
                                    borderBottom: j < popup.route.flights.length - 1 ? '1px solid #f0f0f0' : 'none',
                                    fontSize: '13px',
                                }}>
                                    <div>
                                        <span style={{ fontWeight: 600 }}>{f.flightNumber}</span>
                                        <span style={{ color: '#888', marginLeft: '8px' }}>{f.airline}</span>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <span style={{ color: '#555' }}>{f.aircraft}</span>
                                        <span style={{ color: '#aaa', marginLeft: '8px', fontSize: '12px' }}>{f.registration}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <p style={{
                            fontSize: '11px', color: '#888', margin: '8px 0 0',
                            paddingTop: '8px', borderTop: '1px solid #eee',
                        }}>
                            {popup.route.count} spotting{popup.route.count !== 1 ? 's' : ''} on this route
                        </p>
                    </div>
                </>
            )}
        </div>
    );
}

function CountryPaths({ dimensions }) {
    const [paths, setPaths] = useState([]);

    useEffect(() => {
        const loadCountries = async () => {
            
            const res = await fetch('/world-110m.json');
            const worldData = await res.json();
            const countries = topojson.feature(worldData, worldData.objects.countries);

            const projection = d3.geoNaturalEarth1()
                .rotate([-150, 0])
                .fitSize([dimensions.width, dimensions.height], { type: 'Sphere' });

            const path = d3.geoPath().projection(projection);

            setPaths(countries.features.map(f => path(f)).filter(Boolean));
        };
        loadCountries();
    }, [dimensions]);

    return (
        <>
            {paths.map((d, i) => (
                <path key={i} d={d} fill="#f0f0f0" stroke="#ddd" strokeWidth={0.5} />
            ))}
        </>
    );
}

export default function Gallery() {
    const [spottings, setSpottings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('gallery');
    const [search, setSearch] = useState('');
    const [showFilter, setShowFilter] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState(null);
    const [selectedYear, setSelectedYear] = useState(null);
    const [filters, setFilters] = useState({ aircraft: '', airport: '' });
    const [calendarCollapsed, setCalendarCollapsed] = useState(false);
    const [likedIds] = useState(new Set());
    const filterRef = useRef(null);
    const [stats, setStats] = useState(null);
    const [selectedSpottings, setSelectedSpottings] = useState([]);
    const [showBackToTop, setShowBackToTop] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setShowBackToTop(window.scrollY > 200);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (showFilter && filterRef.current && !filterRef.current.contains(e.target)) {
                setShowFilter(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showFilter]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [spottingsRes, statsRes] = await Promise.all([
                api.get('/spotting/all'),
                api.get('/spotting/stats'),
            ]);
            setSpottings(spottingsRes.data);
            setStats(statsRes.data);
        } catch (err) {
            console.error('Failed to fetch', err);
        } finally {
            setLoading(false);
        }
    };


    const getMonthGroups = () => {
        return stats?.monthCounts || {};
    };

    const getMonthRange = () => {
        const now = new Date();
        const start = new Date(2025, 7, 1); // August 2025 (month is 0-indexed)
        const months = [];

        while (start <= now) {
            const year = start.getFullYear();
            const month = start.getMonth();
            const key = `${year}-${String(month + 1).padStart(2, '0')}`;
            months.push({ key, year, month });
            start.setMonth(start.getMonth() + 1);
        }

        return months;
    };

    const aircraft = stats?.filters?.aircraft ? [...new Map(stats.filters.aircraft.map(a => [a.icaoCode, a])).values()] : [];
    const airports = stats?.filters?.airports ? [...stats.filters.airports] : [];

    const handleLike = async (id) => {
        try {
            await api.post(`/spotting/${id}/like`);
            setSpottings(spottings.map(s =>
                s.id === id ? { ...s, likes: (s.likes || 0) + 1 } : s
            ));
        } catch (err) {
            console.error('Failed to like', err);
        }
    };

    const getPhotoUrl = (url) => {
        if (!url) return null;
        return url.startsWith('/api') ? url : `/api/photo/${url}`;
    };

    const getLocationCounts = () => {
        return stats?.locations || [];
    };

    const filtered = spottings
        .filter(s => {
            if (filters.aircraft && s.aircraft?.icaoCode !== filters.aircraft) return false;
            if (filters.airport && s.spotLocation?.id !== filters.airport) return false;
            return true;
        })
        .filter(s => {
            if (!search.trim()) return true;
            const q = search.toLowerCase();
            return (
                (s.registration || '').toLowerCase().includes(q) ||
                (s.airline?.airlineName || '').toLowerCase().includes(q) ||
                (s.aircraft?.typeName || '').toLowerCase().includes(q) ||
                (s.notes || '').toLowerCase().includes(q)
            );
        })
        .sort((a, b) => {
            return (b.spotDate || '').localeCompare(a.spotDate || '');
        });

    const clearFilters = () => {
        setFilters({ aircraft: '', airport: '' });
    };

    const hasActiveFilters = filters.aircraft || filters.airport;

    if (activeTab === 'about') {
        return (
            <div style={{ minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
                <NavBar activeTab={activeTab} setActiveTab={setActiveTab} />
                <div style={{
                    maxWidth: '720px', margin: '60px auto', padding: '0 24px',
                    lineHeight: '1.8', color: '#333', fontSize: '16px',
                }}>
                    <div style={{
                        float: 'right',
                        marginLeft: '32px',
                        marginBottom: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '12px',
                    }}>
                        <img
                            src="/aboutme.PNG"
                            alt="Jimmy"
                            style={{
                                width: '160px',
                                height: '160px',
                                borderRadius: '50%',
                                objectFit: 'cover',
                                border: '3px solid #eee',
                            }}
                        />
                        <div style={{ display: 'flex', gap: '50px' }}>
                            <a href="https://www.instagram.com/jimmyjia02/" target="_blank" rel="noopener noreferrer">
                                <img src="/instagram.png" alt="Instagram" style={{ width: '28px', height: '28px', transition: 'opacity 0.2s', opacity: 0.6 }} onMouseEnter={(e) => e.currentTarget.style.opacity = 1} onMouseLeave={(e) => e.currentTarget.style.opacity = 0.6} />
                            </a>
                            <a href="https://www.linkedin.com/in/jianing-jia" target="_blank" rel="noopener noreferrer">
                                <img src="/linkedin.png" alt="LinkedIn" style={{ width: '28px', height: '28px', transition: 'opacity 0.2s', opacity: 0.6 }} onMouseEnter={(e) => e.currentTarget.style.opacity = 1} onMouseLeave={(e) => e.currentTarget.style.opacity = 0.6} />
                            </a>
                            <a href="https://www.jetphotos.com/photographer/537489" target="_blank" rel="noopener noreferrer">
                                <img src="/jp.png" alt="JetPhotos" style={{ width: '28px', height: '28px', transition: 'opacity 0.2s', opacity: 0.6 }} onMouseEnter={(e) => e.currentTarget.style.opacity = 1} onMouseLeave={(e) => e.currentTarget.style.opacity = 0.6} />
                            </a>
                        </div>
                    </div>
                    <ReactMarkdown rehypePlugins={[rehypeRaw]}
                        components={{
                            h1: ({ children }) => <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '16px', letterSpacing: '-0.5px', color: '#1a1a1a' }}>{children}</h1>,
                            h2: ({ children }) => <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '12px', marginTop: '32px', letterSpacing: '-0.3px', color: '#1a1a1a' }}>{children}</h2>,
                            h3: ({ children }) => <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', marginTop: '24px', color: '#333' }}>{children}</h3>,
                            p: ({ children }) => <p style={{ marginBottom: '16px', lineHeight: '1.8' }}>{children}</p>,
                            a: ({ href, children }) => <a href={href} style={{ color: '#2a6cb6', textDecoration: 'none' }} target="_blank" rel="noopener noreferrer">{children}</a>,
                            ul: ({ children }) => <ul style={{ marginBottom: '16px', paddingLeft: '24px' }}>{children}</ul>,
                            li: ({ children }) => <li style={{ marginBottom: '6px' }}>{children}</li>,
                            img: ({ src, alt }) => <img src={src} alt={alt} style={{ maxWidth: '100%', borderRadius: '8px', margin: '16px 0' }} />,
                            blockquote: ({ children }) => <blockquote style={{ borderLeft: '3px solid #ddd', paddingLeft: '16px', color: '#666', margin: '16px 0', fontStyle: 'italic' }}>{children}</blockquote>,
                        }}
                    >
                        {aboutContent}
                    </ReactMarkdown>
                    <div style={{
                        display: 'flex',
                        gap: '16px',
                        marginTop: '32px',
                        justifyContent: 'center',
                    }}>
                        <img src="/adb.png" alt="" style={{
                            borderRadius: '8px',
                            objectFit: 'cover',
                            height: '100px',
                        }} />
                        <img src="/fr24.png" alt="" style={{
                            borderRadius: '8px',
                            objectFit: 'cover',
                            height: '100px',
                        }} />
                    </div>
                </div>
                <footer style={{
                    textAlign: 'center',
                    padding: '48px 24px 32px',
                    color: '#bbb',
                    fontSize: '13px',
                    fontFamily: "'DM Sans', sans-serif",
                    borderTop: '1px solid #f0f0f0',
                    marginTop: '48px',
                }}>
                    <p style={{ marginBottom: '4px' }}>© {new Date().getFullYear()} Jimmy's Aviation · Melbourne, Australia</p>
                    <p>COYG!</p>
                </footer>
            </div>
        );
    }

    if (activeTab === 'logbook') {
        const monthGroups = getMonthGroups();
        const months = getMonthRange();
        const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        const yearGroups = {};
        months.forEach(m => {
            if (!yearGroups[m.year]) yearGroups[m.year] = [];
            yearGroups[m.year].push(m);
        });

        // Count total spottings per year
        const yearCounts = {};
        Object.entries(yearGroups).forEach(([year, yearMonths]) => {
            yearCounts[year] = yearMonths.reduce((sum, m) => sum + (monthGroups[m.key] || 0), 0);
        });

        return (
            <div style={{ minHeight: '100vh', fontFamily: "'DM Sans', sans-serif", background: '#fff' }}>
                <NavBar activeTab={activeTab} setActiveTab={setActiveTab} />

                <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 24px' }}>
                    <h2 style={{
                        fontSize: '18px',
                        fontWeight: 700,
                        color: '#1a1a2e',
                        marginBottom: '16px',
                        letterSpacing: '-0.3px',
                    }}>Spotting Locations</h2>

                    <SpottingMap locations={getLocationCounts()} />

                    <h2 style={{
                        fontSize: '18px',
                        fontWeight: 700,
                        color: '#1a1a2e',
                        marginBottom: '16px',
                        letterSpacing: '-0.3px',
                    }}>Spotting Routes</h2>
                    <RouteMap spottings={spottings} />

                    <h2 style={{
                        fontSize: '18px',
                        fontWeight: 700,
                        color: '#1a1a2e',
                        marginBottom: '16px',
                        marginTop: '12px',
                        letterSpacing: '-0.3px',
                    }}>Spotting Timeline</h2>

                    {/* Collapsed bar — shown when a month is selected */}
                    {calendarCollapsed && selectedMonth && (
                        <div
                            onClick={() => {
                                setCalendarCollapsed(false);
                                setSelectedMonth(null);
                                setSelectedSpottings([]);
                            }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '14px 20px',
                                background: '#6e6e6e',
                                borderRadius: '10px',
                                cursor: 'pointer',
                                marginBottom: '24px',
                                transition: 'all 0.3s ease',
                            }}
                        >
                            <span style={{ color: '#fff', fontSize: '15px', fontWeight: 600 }}>
                                ✈️ {MONTH_NAMES[parseInt(selectedMonth.slice(5)) - 1]} {selectedMonth.slice(0, 4)}
                                <span style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 400, marginLeft: '8px' }}>
                                    {selectedSpottings.length} spotting{selectedSpottings.length !== 1 ? 's' : ''}
                                </span>
                            </span>
                            <span style={{ color: 'rgb(255, 255, 255)', fontSize: '13px' }}>
                                ▼ Show months
                            </span>
                        </div>
                    )}

                    {/* Calendar content — hidden when month is selected */}
                    <div style={{
                        maxHeight: calendarCollapsed ? '0px' : '2000px',
                        overflow: 'hidden',
                        transition: 'max-height 0.5s ease, opacity 0.3s ease',
                        opacity: calendarCollapsed ? 0 : 1,
                    }}>

                        {/* Level 1 — Year circles (no year selected) */}
                        {!selectedYear && (
                            <>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    gap: '40px',
                                    flexWrap: 'wrap',
                                    marginBottom: '24px',
                                }}>
                                    {Object.entries(yearGroups).sort(([a], [b]) => b - a).map(([year]) => {
                                        const count = yearCounts[year] || 0;
                                        const hasSpottings = count > 0;

                                        return (
                                            <div
                                                key={year}
                                                onClick={() => {
                                                    if (hasSpottings) setSelectedYear(year);
                                                }}
                                                style={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    gap: '10px',
                                                    cursor: hasSpottings ? 'pointer' : 'default',
                                                    opacity: hasSpottings ? 1 : 0.4,
                                                    padding: '12px',
                                                }}
                                            >
                                                <div style={{
                                                    width: '88px',
                                                    height: '88px',
                                                    borderRadius: '50%',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    background: hasSpottings ? '#f8f8fa' : '#fafafa',
                                                    border: '1.5px solid #eee',
                                                    transition: 'all 0.2s',
                                                }}>
                                                    <span style={{
                                                        fontSize: '22px',
                                                        fontWeight: 700,
                                                        color: hasSpottings ? '#1a1a1a' : '#ccc',
                                                    }}>
                                                        {count}
                                                    </span>
                                                </div>
                                                <span style={{
                                                    fontSize: '16px',
                                                    fontWeight: 700,
                                                    color: '#1a1a2e',
                                                }}>
                                                    {year} {getLunarAnimal(Number(year))}
                                                </span>
                                                {hasSpottings && (
                                                    <span style={{ fontSize: '14px', marginTop: '-6px' }}>✈️</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                <p style={{ textAlign: 'center', color: '#888', fontSize: '14px' }}>
                                    Click a year to explore
                                </p>
                            </>
                        )}

                        {/* Level 2 — Month circles (year selected) */}
                        {selectedYear && (
                            <>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    marginBottom: '24px',
                                    paddingBottom: '12px',
                                    borderBottom: '2px solid #eee',
                                }}>
                                    <button
                                        onClick={() => setSelectedYear(null)}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            fontSize: '18px',
                                            color: '#888',
                                            padding: '4px 8px',
                                            borderRadius: '6px',
                                            transition: 'background 0.15s',
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = '#f0f0f0'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                                    >
                                        ←
                                    </button>
                                    <div style={{
                                        fontSize: '20px',
                                        fontWeight: 200,
                                        color: '#1a1a2e',
                                        margin: 0,
                                    }}>
                                        {selectedYear}
                                        <span style={{ marginLeft: '10px' }}>
                                            {getLunarAnimal(Number(selectedYear))}
                                        </span>
                                        <span style={{ fontSize: '14px', color: '#888', marginLeft: '12px' }}>
                                            {yearCounts[selectedYear] || 0} spottings
                                        </span>
                                    </div>
                                </div>

                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                                    gap: '20px',
                                }}>
                                    {[...(yearGroups[selectedYear] || [])].reverse().map(({ key, month }) => {
                                        const count = monthGroups[key] || 0;
                                        const hasSpottings = count > 0;
                                        const isSelected = selectedMonth === key;

                                        return (
                                            <div
                                                key={key}
                                                onClick={async () => {
                                                    if (hasSpottings) {
                                                        if (isSelected) {
                                                            setSelectedMonth(null);
                                                            setCalendarCollapsed(false);
                                                            setSelectedSpottings([]);
                                                        } else {
                                                            setSelectedMonth(key);
                                                            setCalendarCollapsed(true);
                                                            try {
                                                                const res = await api.get('/spotting/filter/month/' + key);
                                                                setSelectedSpottings(res.data);
                                                            } catch (err) {
                                                                console.error('Failed to fetch month spottings', err);
                                                            }
                                                        }
                                                    }
                                                }}
                                                style={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    cursor: hasSpottings ? 'pointer' : 'default',
                                                    opacity: hasSpottings ? 1 : 0.4,
                                                    padding: '8px',
                                                }}
                                            >
                                                <div style={{
                                                    width: '72px',
                                                    height: '72px',
                                                    borderRadius: '50%',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    background: isSelected ? '#1a1a2e' : hasSpottings ? '#f8f8fa' : '#fafafa',
                                                    border: isSelected ? '2px solid #1a1a2e' : '1.5px solid #eee',
                                                    transition: 'all 0.2s',
                                                    boxShadow: isSelected ? '0 4px 12px rgba(26,26,46,0.2)' : 'none',
                                                }}>
                                                    <span style={{
                                                        fontSize: '18px',
                                                        fontWeight: 700,
                                                        color: isSelected ? '#fff' : hasSpottings ? '#1a1a1a' : '#ccc',
                                                    }}>
                                                        {count}
                                                    </span>
                                                </div>
                                                <span style={{
                                                    fontSize: '15px',
                                                    fontWeight: 600,
                                                    color: '#000000',
                                                    letterSpacing: '0.5px',
                                                }}>
                                                    {MONTH_NAMES[month]}
                                                </span>
                                                {hasSpottings && (
                                                    <span style={{ fontSize: '14px', marginTop: '-4px' }}>✈️</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {!selectedMonth && (
                                    <p style={{ textAlign: 'center', color: '#888', fontSize: '14px', marginTop: '20px' }}>
                                        Click a month to see spottings
                                    </p>
                                )}
                            </>
                        )}
                    </div>

                    {/* Level 3 — Selected month spottings */}
                    {selectedMonth && (
                        <div style={{ marginTop: '20px' }}>
                            <h3 style={{
                                fontSize: '18px', fontWeight: 600, marginBottom: '20px',
                                letterSpacing: '-0.2px', color: '#333',
                            }}>
                                {MONTH_NAMES[parseInt(selectedMonth.slice(5)) - 1]} {selectedMonth.slice(0, 4)}
                                <span style={{ color: '#888', fontWeight: 400, marginLeft: '8px', fontSize: '14px' }}>
                                    {selectedSpottings.length} spotting{selectedSpottings.length !== 1 ? 's' : ''}
                                </span>
                            </h3>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                                gap: '20px',
                            }}>
                                {selectedSpottings.map(s => (
                                    <SpottingCard key={s.id} spotting={s} onLike={handleLike} getPhotoUrl={getPhotoUrl} likedIds={likedIds} />
                                ))}
                            </div>
                        </div>
                    )}

                </div>
                <footer style={{
                    textAlign: 'center',
                    padding: '48px 24px 32px',
                    color: '#bbb',
                    fontSize: '13px',
                    fontFamily: "'DM Sans', sans-serif",
                    borderTop: '1px solid #f0f0f0',
                    marginTop: '48px',
                }}>
                    <p style={{ marginBottom: '4px' }}>© {new Date().getFullYear()} Jimmy's Aviation · Melbourne, Australia</p>
                    <p>COYG!</p>
                </footer>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', fontFamily: "'DM Sans', sans-serif", background: '#fff' }}>
            <NavBar activeTab={activeTab} setActiveTab={setActiveTab} />

            {/* Controls row */}
            <div style={{
                maxWidth: '1200px', margin: '0 auto', padding: '24px 16px 0',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                flexWrap: 'wrap', gap: '12px',
            }}>
                {/* Filter button */}
                <div style={{ position: 'relative' }} ref={filterRef}>
                    <button
                        onClick={() => setShowFilter(!showFilter)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '10px 20px',
                            background: '#fff',
                            border: hasActiveFilters ? '2px solid #1a1a2e' : '1.5px solid #ddd',
                            borderRadius: '24px',
                            fontSize: '14px', fontWeight: 600,
                            cursor: 'pointer', color: '#333',
                        }}
                    >
                        <span style={{ fontSize: '16px' }}>☰</span>
                        FILTER
                        {hasActiveFilters && (
                            <span style={{
                                background: '#1a1a2e', color: '#fff', borderRadius: '50%',
                                width: '18px', height: '18px', fontSize: '11px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>✓</span>
                        )}
                    </button>

                    {/* Filter dropdown */}
                    {showFilter && (
                        <div style={{
                            position: 'absolute', top: '48px', left: 0, zIndex: 10,
                            background: '#fff', borderRadius: '12px',
                            border: '1px solid #eee', padding: '20px',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                            width: '320px',
                        }}>

                            {/* Aircraft — chip buttons */}
                            <div style={{ marginBottom: '16px' }}>
                                <label style={filterLabelStyle}>Aircraft</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    <button
                                        onClick={() => setFilters({ ...filters, aircraft: '' })}
                                        style={{
                                            padding: '6px 14px',
                                            borderRadius: '20px',
                                            fontSize: '13px',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            border: filters.aircraft === '' ? '2px solid #1a1a2e' : '1px solid #ddd',
                                            background: filters.aircraft === '' ? '#1a1a2e' : '#fff',
                                            color: filters.aircraft === '' ? '#fff' : '#333',
                                            transition: 'all 0.15s',
                                        }}
                                    >All</button>
                                    {aircraft.map(a => (
                                        <button
                                            key={a.id}
                                            onClick={() => setFilters({ ...filters, aircraft: a.icaoCode })}
                                            style={{
                                                padding: '6px 14px',
                                                borderRadius: '20px',
                                                fontSize: '13px',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                border: filters.aircraft === a.icaoCode ? '2px solid #1a1a2e' : '1px solid #ddd',
                                                background: filters.aircraft === a.icaoCode ? '#1a1a2e' : '#fff',
                                                color: filters.aircraft === a.icaoCode ? '#fff' : '#333',
                                                transition: 'all 0.15s',
                                            }}
                                        >{a.icaoCode}</button>
                                    ))}
                                </div>
                            </div>

                            {/* Airport */}
                            <div style={{ marginBottom: '16px' }}>
                                <label style={filterLabelStyle}>Airport</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    <button
                                        onClick={() => setFilters({ ...filters, airport: '' })}
                                        style={{
                                            padding: '6px 14px',
                                            borderRadius: '20px',
                                            fontSize: '13px',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            border: filters.airport === '' ? '2px solid #1a1a2e' : '1px solid #ddd',
                                            background: filters.airport === '' ? '#1a1a2e' : '#fff',
                                            color: filters.airport === '' ? '#fff' : '#333',
                                            transition: 'all 0.15s',
                                        }}
                                    >All</button>
                                    {airports.map(a => (
                                        <button
                                            key={a.id}
                                            onClick={() => setFilters({ ...filters, airport: a.id })}
                                            style={{
                                                padding: '6px 14px',
                                                borderRadius: '20px',
                                                fontSize: '13px',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                border: filters.airport === a.id ? '2px solid #1a1a2e' : '1px solid #ddd',
                                                background: filters.airport === a.id ? '#1a1a2e' : '#fff',
                                                color: filters.airport === a.id ? '#fff' : '#333',
                                                transition: 'all 0.15s',
                                            }}
                                        >{a.iata}</button>
                                    ))}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={clearFilters} style={{
                                    flex: 1, padding: '8px', background: '#f5f5f5',
                                    border: 'none', borderRadius: '6px', fontSize: '13px',
                                    cursor: 'pointer',
                                }}>Clear</button>
                                <button onClick={() => setShowFilter(false)} style={{
                                    flex: 1, padding: '8px', background: '#1a1a2e', color: '#fff',
                                    border: 'none', borderRadius: '6px', fontSize: '13px',
                                    cursor: 'pointer', fontWeight: 600,
                                }}>Apply</button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Search bar */}
                <div style={{
                    display: 'flex', alignItems: 'center',
                    border: '1.5px solid #ddd', borderRadius: '24px',
                    padding: '8px 16px', width: '280px',
                }}>
                    <span style={{ color: '#888', marginRight: '8px', fontSize: '16px' }}>🔍</span>
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search with keywords..."
                        style={{
                            border: 'none', outline: 'none', fontSize: '14px',
                            width: '100%', background: 'transparent',
                        }}
                    />
                </div>
            </div>

            {/* Card grid */}
            <div style={{
                maxWidth: '1200px', margin: '24px auto', padding: '0 24px',
            }}>
                {loading ? (
                    <p style={{ textAlign: 'center', color: '#888', padding: '60px 0' }}>Loading...</p>
                ) : filtered.length === 0 ? (
                    <p style={{ textAlign: 'center', color: '#888', padding: '60px 0', fontSize: '15px' }}>
                        {search || hasActiveFilters ? 'No spottings match your filters.' : 'No spottings yet.'}
                    </p>
                ) : (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                        gap: '20px',
                    }}>
                        {filtered.map(s => (
                            <SpottingCard key={s.id} spotting={s} onLike={handleLike} getPhotoUrl={getPhotoUrl} />
                        ))}
                    </div>
                )}
            </div>

            {showBackToTop && (
                <button
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    style={{
                        position: 'fixed',
                        bottom: '32px',
                        right: '32px',
                        width: '44px',
                        height: '44px',
                        borderRadius: '50%',
                        background: '#1a1a2e',
                        color: '#fff',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '20px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'opacity 0.3s',
                        zIndex: 50,
                    }}
                >
                    ↑
                </button>
            )}

            <footer style={{
                textAlign: 'center',
                padding: '48px 24px 32px',
                color: '#bbb',
                fontSize: '13px',
                fontFamily: "'DM Sans', sans-serif",
                borderTop: '1px solid #f0f0f0',
                marginTop: '48px',
            }}>
                <p style={{ marginBottom: '4px' }}>© {new Date().getFullYear()} Jimmy's Aviation · Melbourne, Australia</p>
                <p>COYG!</p>
            </footer>
        </div>
    );
}

function NavBar({ activeTab, setActiveTab }) {
    return (
        <nav style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '24px',
            padding: '24px 16px',
            borderBottom: '1px solid #eee',
            flexWrap: 'wrap',
        }}>
            {TABS.map(tab => (
                <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    style={{
                        background: 'none', border: 'none',
                        fontSize: '14px', fontWeight: 700,
                        letterSpacing: '1px',
                        color: activeTab === tab.key ? '#1a1a1a' : '#bbb',
                        cursor: 'pointer',
                        padding: '4px 0',
                        borderBottom: activeTab === tab.key ? '2px solid #1a1a1a' : '2px solid transparent',
                        transition: 'all 0.2s',
                        fontFamily: "'DM Sans', sans-serif",
                    }}
                >
                    {tab.label}
                </button>
            ))}
        </nav>
    );
}

function SpottingCard({ spotting, onLike, getPhotoUrl }) {
    const navigate = useNavigate();
    const photoUrl = getPhotoUrl(spotting.photoUrl);

    return (
        <div style={{
            background: '#fff',
            borderRadius: '10px',
            border: '1px solid #eee',
            overflow: 'hidden',
            transition: 'box-shadow 0.2s',
            cursor: 'default',
        }}
            onClick={() => navigate(`/spotting/${spotting.id}`)}
            onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'}
            onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
        >
            {/* Photo */}
            <div style={{
                width: '100%',
                aspectRatio: '16 / 9',
                background: '#f0f0f0',
                overflow: 'hidden',
            }}>
                {photoUrl ? (
                    <img
                        src={photoUrl}
                        alt={spotting.registration}
                        loading="lazy"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                ) : (
                    <div style={{
                        width: '100%', height: '100%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#ccc', fontSize: '40px',
                    }}>📷</div>
                )}
            </div>

            {/* Details */}
            <div style={{ padding: '14px 16px' }}>
                <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', marginBottom: '6px',
                }}>
                    <span style={{ fontWeight: 700, fontSize: '14px', color: '#1a1a1a' }}>
                        {spotting.registration || '—'}
                    </span>
                    <span style={{ fontSize: '13px', color: '#555', fontWeight: 500 }}>
                        {spotting.airline?.airlineName || '—'}
                    </span>
                </div>

                <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center',
                }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <button
                            onClick={() => onLike(spotting.id)}
                            style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                padding: 0, display: 'flex', alignItems: 'center', gap: '4px',
                                color: '#666', fontSize: '13px',
                            }}
                        >
                            👍 {spotting.likes || 0}
                        </button>
                    </div>
                    <span style={{ fontSize: '13px', color: '#555' }}>
                        {spotting.aircraft?.typeName || '—'}
                    </span>
                </div>
            </div>
        </div>
    );
}

const filterLabelStyle = {
    display: 'block', fontSize: '12px', fontWeight: 600,
    color: '#888', textTransform: 'uppercase',
    letterSpacing: '0.5px', marginBottom: '6px',
};

const selectStyle = {
    width: '100%', padding: '8px 10px',
    border: '1px solid #ddd', borderRadius: '6px',
    fontSize: '14px', outline: 'none',
    background: '#fff',
};
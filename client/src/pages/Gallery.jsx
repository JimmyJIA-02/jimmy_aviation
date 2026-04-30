import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import aboutContent from '../assets/about.md?raw';

import api from '../api/axios';

const TABS = [
    { key: 'gallery', label: 'GALLERY' },
    { key: 'calendar', label: 'SPOTTING CALENDAR' },
    { key: 'about', label: 'ABOUT ME' },
];

const LUNAR_ANIMALS = ['🐉', '🐍', '🐎', '🐑', '🐒', '🐓', '🐕', '🐖', '🐀', '🐂', '🐅', '🐇'];

const getLunarAnimal = (year) => LUNAR_ANIMALS[(year - 2024) % 12];

export default function Gallery() {
    const [spottings, setSpottings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('gallery');
    const [search, setSearch] = useState('');
    const [showFilter, setShowFilter] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState(null);
    const [filters, setFilters] = useState({ airline: '', aircraft: '', airport: '' });
    const [calendarCollapsed, setCalendarCollapsed] = useState(false);
    const [likedIds, setLikedIds] = useState(new Set());
    const filterRef = useRef(null);

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
            const spottingsRes = await api.get('/spotting');
            setSpottings(spottingsRes.data);
        } catch (err) {
            console.error('Failed to fetch', err);
        } finally {
            setLoading(false);
        }
    };

    const getMonthGroups = () => {
        const groups = {};
        spottings.forEach(s => {
            if (!s.spotDate) return;
            const key = s.spotDate.slice(0, 7); // "2026-03"
            if (!groups[key]) groups[key] = [];
            groups[key].push(s);
        });
        return groups;
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

    const airlines = [...new Map(
        spottings.filter(s => s.airline).map(s => [s.airline.id, s.airline])
    ).values()];

    const aircraft = [...new Map(
        spottings.filter(s => s.aircraft).map(s => [s.aircraft.icaoCode, s.aircraft])
    ).values()];

    const airports = [...new Map(
        spottings.filter(s => s.spotLocation).map(s => [s.spotLocation.id, s.spotLocation])
    ).values()];

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

    const filtered = spottings
        .filter(s => {
            if (filters.airline && s.airline?.id !== filters.airline) return false;
            if (filters.aircraft && s.aircraft?.id !== filters.aircraft) return false;
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
        setFilters({ airline: '', aircraft: '', airport: '' });
    };

    const hasActiveFilters = filters.airline || filters.aircraft || filters.airport;

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
            </div>
        );
    }

    if (activeTab === 'calendar') {
        const monthGroups = getMonthGroups();
        const months = getMonthRange();
        const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const selectedSpottings = selectedMonth ? (monthGroups[selectedMonth] || []) : [];

        const yearGroups = {};
        months.forEach(m => {
            if (!yearGroups[m.year]) yearGroups[m.year] = [];
            yearGroups[m.year].push(m);
        });

        return (
            <div style={{ minHeight: '100vh', fontFamily: "'DM Sans', sans-serif", background: '#fff' }}>
                <NavBar activeTab={activeTab} setActiveTab={setActiveTab} />

                <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 24px' }}>

                    {/* Collapsed bar */}
                    {calendarCollapsed && selectedMonth && (
                        <div
                            onClick={() => {
                                setCalendarCollapsed(false);
                                setSelectedMonth(null);
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
                                ▼ Show calendar
                            </span>
                        </div>
                    )}

                    {/* Full calendar */}
                    <div style={{
                        maxHeight: calendarCollapsed ? '0px' : '2000px',
                        overflow: 'hidden',
                        transition: 'max-height 0.5s ease, opacity 0.3s ease',
                        opacity: calendarCollapsed ? 0 : 1,
                    }}>
                        {Object.entries(yearGroups).sort(([a], [b]) => b - a).map(([year, yearMonths]) => (
                            <div key={year} style={{ marginBottom: '36px' }}>
                                <h3 style={{
                                    fontSize: '25px',
                                    fontWeight: 700,
                                    color: '#1a1a2e',
                                    marginBottom: '20px',
                                    paddingBottom: '8px',
                                    borderBottom: '2px solid #eee',
                                }}>{year}
                                    <span style={{ fontWeight: 400, marginLeft: '10px' }}>
                                        {getLunarAnimal(Number(year))}
                                    </span>
                                </h3>

                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(4, 1fr)',
                                    gap: '20px',
                                }}>
                                    {[...yearMonths].reverse().map(({ key, month }) => {
                                        const count = (monthGroups[key] || []).length;
                                        const hasSpottings = count > 0;
                                        const isSelected = selectedMonth === key;

                                        return (
                                            <div
                                                key={key}
                                                onClick={() => {
                                                    if (hasSpottings) {
                                                        if (isSelected) {
                                                            setSelectedMonth(null);
                                                            setCalendarCollapsed(false);
                                                        } else {
                                                            setSelectedMonth(key);
                                                            setCalendarCollapsed(true);
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
                            </div>
                        ))}

                        {!selectedMonth && (
                            <p style={{ textAlign: 'center', color: '#888', fontSize: '14px' }}>
                                Click a month to see spottings
                            </p>
                        )}
                    </div>

                    {/* Selected month spottings */}
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
                                gridTemplateColumns: 'repeat(4, 1fr)',
                                gap: '20px',
                            }}>
                                {selectedSpottings.map(s => (
                                    <SpottingCard key={s.id} spotting={s} onLike={handleLike} getPhotoUrl={getPhotoUrl} likedIds={likedIds} />
                                ))}
                            </div>
                        </div>
                    )}

                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', fontFamily: "'DM Sans', sans-serif", background: '#fff' }}>
            <NavBar activeTab={activeTab} setActiveTab={setActiveTab} />

            {/* Controls row */}
            <div style={{
                maxWidth: '1200px', margin: '0 auto', padding: '24px 24px 0',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
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
                            {/* Airline */}
                            <div style={{ marginBottom: '16px' }}>
                                <label style={filterLabelStyle}>Airline</label>
                                <select
                                    value={filters.airline}
                                    onChange={(e) => setFilters({ ...filters, airline: e.target.value })}
                                    style={selectStyle}
                                >
                                    <option value="">All Airlines</option>
                                    {airlines.map(a => (
                                        <option key={a.id} value={a.id}>{a.airlineName}</option>
                                    ))}
                                </select>
                            </div>

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
                                            onClick={() => setFilters({ ...filters, aircraft: a.id })}
                                            style={{
                                                padding: '6px 14px',
                                                borderRadius: '20px',
                                                fontSize: '13px',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                border: filters.aircraft === a.id ? '2px solid #1a1a2e' : '1px solid #ddd',
                                                background: filters.aircraft === a.id ? '#1a1a2e' : '#fff',
                                                color: filters.aircraft === a.id ? '#fff' : '#333',
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
                                        >{a.iataCode}</button>
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
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        gap: '20px',
                    }}>
                        {filtered.map(s => (
                            <SpottingCard key={s.id} spotting={s} onLike={handleLike} getPhotoUrl={getPhotoUrl} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function NavBar({ activeTab, setActiveTab }) {
    return (
        <nav style={{
            display: 'flex', justifyContent: 'center', gap: '60px',
            padding: '24px 0',
            borderBottom: '1px solid #eee',
        }}>
            {TABS.map(tab => (
                <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    style={{
                        background: 'none', border: 'none',
                        fontSize: '15px', fontWeight: 700,
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
                aspectRatio: '4 / 3',
                background: '#f0f0f0',
                overflow: 'hidden',
            }}>
                {photoUrl ? (
                    <img
                        src={photoUrl}
                        alt={spotting.registration}
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
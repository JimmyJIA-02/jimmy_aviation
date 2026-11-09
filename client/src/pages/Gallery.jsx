import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import aboutContent from '../assets/about.md?raw';


import api from '../api/axios';
import RouteMap from '../components/RouteMap';
import SpottingLocations from '../components/SpottingLocations';
import { FilterSheet, ActiveFilters } from '../components/GalleryFilters';
import { EMPTY_FILTERS, facetRows, passes } from '../utils/galleryFilters';
import { tagInfo } from '../utils/spottingTags';
import { searchFields, queryWords, matchesQuery } from '../utils/search';

const TABS = [
    { key: 'gallery', label: 'GALLERY' },
    { key: 'logbook', label: 'LOGBOOK' },
    { key: 'about', label: 'ABOUT ME' },
];

export default function Gallery() {
    const [spottings, setSpottings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('gallery');
    // kept in the address (?q=qantas), so it survives going back from a spotting and can be shared
    const [search, setSearch] = useState(() => new URLSearchParams(window.location.search).get('q') || '');
    const [showFilter, setShowFilter] = useState(false);
    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [showBackToTop, setShowBackToTop] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setShowBackToTop(window.scrollY > 200);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        const url = new URL(window.location.href);
        if (search.trim()) url.searchParams.set('q', search.trim());
        else url.searchParams.delete('q');
        window.history.replaceState(window.history.state, '', url);
    }, [search]);

    useEffect(() => {
        api.get('/spotting/all')
            .then(res => setSpottings(res.data))
            .catch(err => console.error('Failed to fetch', err))
            .finally(() => setLoading(false));
    }, []);

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

    const searchable = useMemo(() => spottings.map(s => ({ spotting: s, fields: searchFields(s) })), [spottings]);

    // the filter counts follow the search, so they always match what the grid can show
    const rows = useMemo(() => {
        const words = queryWords(search);
        return facetRows(searchable
            .filter(({ fields }) => matchesQuery(fields, words))
            .map(({ spotting }) => spotting));
    }, [searchable, search]);

    const filtered = rows
        .filter(row => passes(row, filters))
        .map(row => row.spotting)
        .sort((a, b) => (b.spotDate || '').localeCompare(a.spotDate || ''));

    const openAirport = (iata) => {
        setFilters({ ...EMPTY_FILTERS, at: [iata] });
        setActiveTab('gallery');
        window.scrollTo({ top: 0 });
    };

    const closeFilter = useCallback(() => setShowFilter(false), []);

    const pickCount = Object.values(filters).reduce((n, picked) => n + picked.length, 0);
    const hasActiveFilters = pickCount > 0;

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

                    <SpottingLocations onOpenAirport={openAirport} />

                    <h2 style={{
                        fontSize: '18px',
                        fontWeight: 700,
                        color: '#1a1a2e',
                        marginBottom: '16px',
                        letterSpacing: '-0.3px',
                    }}>Spotting Routes</h2>
                    <RouteMap spottings={spottings} />
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
                {/* Filter button: opens the filter panel */}
                <button
                    onClick={() => setShowFilter(true)}
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
                            background: '#1a1a2e', color: '#fff', borderRadius: '999px',
                            minWidth: '20px', height: '20px', padding: '0 6px', fontSize: '11px', boxSizing: 'border-box',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>{pickCount}</span>
                    )}
                </button>

                {/* Search bar */}
                <div style={{
                    display: 'flex', alignItems: 'center',
                    border: '1.5px solid #ddd', borderRadius: '24px',
                    // wide enough for the whole placeholder; on a phone it takes the row instead
                    padding: '8px 16px', width: '400px', maxWidth: '100%', boxSizing: 'border-box',
                }}>
                    <span style={{ color: '#888', marginRight: '8px', fontSize: '16px' }}>🔍</span>
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search for airline, registration, flight, airport..."
                        style={{
                            border: 'none', outline: 'none', fontSize: '14px',
                            width: '100%', background: 'transparent',
                        }}
                    />
                </div>
            </div>

            <ActiveFilters filters={filters} onChange={setFilters} shown={filtered.length} total={spottings.length} />
            <FilterSheet open={showFilter} onClose={closeFilter} rows={rows} filters={filters}
                onChange={setFilters} resultCount={filtered.length} />

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
                position: 'relative',
            }}>
                {/* categories, e.g. "🎨 Special livery" */}
                {spotting.tags?.length > 0 && (
                    <div style={{
                        position: 'absolute', left: '8px', bottom: '8px', right: '8px',
                        display: 'flex', flexWrap: 'wrap', gap: '4px', pointerEvents: 'none',
                    }}>
                        {spotting.tags.map(key => tagInfo(key)).filter(Boolean).map(tag => (
                            <span key={tag.key} style={{
                                fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '999px',
                                background: 'rgba(255,255,255,0.92)', color: '#1a1a2e',
                            }}>{tag.icon} {tag.label}</span>
                        ))}
                    </div>
                )}
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

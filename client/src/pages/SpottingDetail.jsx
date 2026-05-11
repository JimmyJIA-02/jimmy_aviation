import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789- '.split('');

function SplitFlapChar({ targetChar, delay }) {
    const [currentChar, setCurrentChar] = useState(' ');
    const [flipping, setFlipping] = useState(false);
    const hasAnimated = useRef(false);

    useEffect(() => {
        if (hasAnimated.current) return;
        hasAnimated.current = true;

        const target = (targetChar || ' ').toUpperCase();
        let timeout;
        let flipCount = 0;
        const totalFlips = Math.floor(Math.random() * 10) + 8;
        const startIndex = Math.floor(Math.random() * CHARS.length);

        timeout = setTimeout(() => {
            const interval = setInterval(() => {
                flipCount++;
                setFlipping(true);

                setTimeout(() => {
                    if (flipCount >= totalFlips) {
                        setCurrentChar(target);
                        setFlipping(false);
                        clearInterval(interval);
                    } else {
                        setCurrentChar(CHARS[(startIndex + flipCount) % CHARS.length]);
                        setFlipping(false);
                    }
                }, 70);
            }, 150);
        }, delay);

        return () => clearTimeout(timeout);
    }, []);

    return (
        <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '20px',
            height: '28px',
            background: '#1a1a1a',
            borderRadius: '3px',
            margin: '0 1px',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.4)',
        }}>
            <div style={{
                position: 'absolute',
                top: '50%',
                left: 0,
                right: 0,
                height: '1px',
                background: 'rgba(0,0,0,0.5)',
                zIndex: 2,
            }} />
            <span style={{
                color: '#f0e060',
                fontSize: '15px',
                fontWeight: 700,
                fontFamily: "'Courier New', monospace",
                transform: flipping ? 'perspective(200px) rotateX(90deg)' : 'perspective(200px) rotateX(0deg)',
                transition: 'transform 0.06s ease-in',
                zIndex: 1,
            }}>
                {currentChar}
            </span>
        </div>
    );
}

function SplitFlapRow({ label, value, maxLen = 16 }) {
    const text = (value || '—').toUpperCase().padEnd(maxLen, ' ').slice(0, maxLen);

    return (
        <div>
            <p style={{
                fontSize: '11px',
                fontWeight: 600,
                color: '#888',
                textTransform: 'uppercase',
                letterSpacing: '1.5px',
                marginBottom: '6px',
                textAlign: 'left',
                width: '100%',
            }}>{label}</p>
            <div style={{
                display: 'flex',
                justifyContent: 'center',
            }}>
                {text.split('').map((char, i) => (
                    <SplitFlapChar key={i} targetChar={char} delay={i * 80 + Math.random() * 150} />
                ))}
            </div>
        </div>
    );
}

export default function SpottingDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [spotting, setSpotting] = useState(null);
    const [loading, setLoading] = useState(true);
    const [liked, setLiked] = useState(false);

    useEffect(() => {
        api.get(`/spotting/${id}`)
            .then(res => setSpotting(res.data))
            .catch(() => navigate('/'))
            .finally(() => setLoading(false));
    }, [id, navigate]);

    const handleLike = async () => {
        if (liked) return;
        try {
            await api.post(`/spotting/${id}/like`);
            setSpotting({ ...spotting, likes: (spotting.likes || 0) + 1 });
            setLiked(true);
        } catch (err) {
            console.error('Failed to like', err);
        }
    };

    const getPhotoUrl = (url) => {
        if (!url) return null;
        return url.startsWith('/api') ? url : `/api/photo/${url}`;
    };

    if (loading) return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif" }}>
            <p style={{ color: '#888' }}>Loading...</p>
        </div>
    );

    if (!spotting) return null;

    const photoUrl = getPhotoUrl(spotting.photoUrl);

    return (
        <div style={{ minHeight: '100vh', fontFamily: "'DM Sans', sans-serif", background: '#fff' }}>
            {/* Top bar */}
            <div style={{
                padding: '20px 40px',
                borderBottom: '1px solid #eee',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
            }}>
                <button
                    onClick={() => navigate('/')}
                    style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: '15px', color: '#333', fontWeight: 500,
                        display: 'flex', alignItems: 'center', gap: '8px',
                        fontFamily: "'DM Sans', sans-serif",
                    }}
                >
                    ← Back to Gallery
                </button>
                <span style={{ fontSize: '13px', color: '#888' }}>
                    Spotted on {spotting.spotDate || ''}
                </span>
            </div>

            {/* Main content */}
            <div style={{
                maxWidth: '1000px',
                margin: '0 auto',
                padding: '40px 24px',
            }}>
                {/* Photo */}
                {photoUrl && (
                    <div style={{
                        width: '100%',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        marginBottom: '32px',
                        background: '#f0f0f0',
                    }}>
                        <img
                            src={photoUrl}
                            alt={spotting.registration}
                            style={{
                                width: '100%',
                                display: 'block',
                                objectFit: 'contain',
                                maxHeight: '600px',
                                userSelect: 'none',
                                WebkitUserSelect: 'none',
                                pointerEvents: 'auto',
                            }}
                            onContextMenu={(e) => e.preventDefault()}
                            draggable={false}
                        />
                    </div>
                )}

                {/* Info section */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '16px',
                    flexWrap: 'wrap',
                    gap: '16px',
                }}>
                    {/* Left column */}
                    <div>
                        <h1 style={{
                            fontSize: '28px', fontWeight: 700,
                            letterSpacing: '-0.5px', margin: '0 0 6px',
                        }}>
                            {spotting.registration || '—'}
                        </h1>
                        <p style={{ fontSize: '18px', color: '#555', margin: '0 0 4px' }}>
                            {spotting.airline?.airlineName || '—'}
                        </p>
                        <p style={{ fontSize: '15px', color: '#888', margin: 0 }}>
                            {spotting.aircraft?.icaoCode || ''} · {spotting.aircraft?.typeName || '—'}
                        </p>
                    </div>

                    {/* Right column */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                    }}>
                        <button
                            onClick={handleLike}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                padding: '8px 18px',
                                background: liked ? '#1a1a2e' : '#f8f8fa',
                                border: '1px solid #eee',
                                borderRadius: '24px',
                                cursor: liked ? 'default' : 'pointer',
                                fontSize: '15px',
                                fontWeight: 600,
                                color: liked ? '#fff' : '#333',
                                transition: 'all 0.15s',
                                fontFamily: "'DM Sans', sans-serif",
                                marginBottom: '6px',
                            }}
                        >
                            👍 {spotting.likes || 0}
                        </button>
                        <p style={{ fontSize: '15px', color: '#555', margin: '0 0 4px', textAlign: 'right' }}>
                            📍 {spotting.spotLocation?.airportName || '—'}
                            {spotting.spotLocation?.iataCode && ` (${spotting.spotLocation.iataCode})`}
                        </p>
                        <p style={{ fontSize: '15px', color: '#999', margin: 0, textAlign: 'right' }}>
                            {spotting.notes || '—'}
                        </p>
                    </div>
                </div>

                {/* Split-flap display */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '16px',
                }}>
                    <div style={{
                        background: '#0a0a0a',
                        borderRadius: '10px',
                        padding: '14px 18px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                        border: '1px solid #222',
                    }}>
                        <SplitFlapRow label="Flight" value={spotting.flight?.flightNumber} maxLen={6} />
                    </div>

                    <div style={{
                        background: '#0a0a0a',
                        borderRadius: '10px',
                        padding: '14px 18px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                        border: '1px solid #222',
                    }}>
                        <SplitFlapRow label="From" value={spotting.flight?.departureAirport} maxLen={12} />
                    </div>

                    <div style={{
                        background: '#0a0a0a',
                        borderRadius: '10px',
                        padding: '14px 18px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                        border: '1px solid #222',
                    }}>
                        <SplitFlapRow label="To" value={spotting.flight?.arrivalAirport} maxLen={12} />
                    </div>
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
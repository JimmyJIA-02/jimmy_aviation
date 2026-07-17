import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789- '.split('');

function SplitFlapChar({ targetChar, delay, small }) {
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
            width: small ? '16px' : '20px',
            height: small ? '22px' : '28px',
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
                fontSize: small ? '12px' : '15px',
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

function SplitFlapRow({ label, value, maxLen = 16, small }) {
    const text = (value || '—').toUpperCase().padEnd(maxLen, ' ').slice(0, maxLen);

    return (
        <div>
            <p style={{
                fontSize: small ? '9px' : '11px',
                fontWeight: 600,
                color: '#888',
                textTransform: 'uppercase',
                letterSpacing: '1.5px',
                marginBottom: small ? '4px' : '6px',
                textAlign: 'left',
                width: '100%',
            }}>{label}</p>
            <div style={{
                display: 'flex',
                justifyContent: small ? 'flex-start' : 'center',
            }}>
                {text.split('').map((char, i) => (
                    <SplitFlapChar key={i} targetChar={char} delay={i * 80 + Math.random() * 150} small={small} />
                ))}
            </div>
        </div>
    );
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

export default function SpottingDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [spotting, setSpotting] = useState(null);
    const [loading, setLoading] = useState(true);
    const [liked, setLiked] = useState(false);
    const isMobile = useIsMobile();

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
                padding: isMobile ? '14px 16px' : '20px 40px',
                borderBottom: '1px solid #eee',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
            }}>
                <button
                    onClick={() => navigate('/')}
                    style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: isMobile ? '14px' : '15px', color: '#333', fontWeight: 500,
                        display: 'flex', alignItems: 'center', gap: '8px',
                        fontFamily: "'DM Sans', sans-serif",
                    }}
                >
                    ← Back
                </button>
                <span style={{ fontSize: isMobile ? '12px' : '13px', color: '#888' }}>
                    Spotted on {spotting.spotDate || ''}
                </span>
            </div>

            {/* Main content */}
            <div style={{
                maxWidth: '1000px',
                margin: '0 auto',
                padding: isMobile ? '16px' : '40px 24px',
            }}>
                {/* Photo */}
                {photoUrl && (
                    <div style={{
                        width: '100%',
                        borderRadius: isMobile ? '8px' : '12px',
                        overflow: 'hidden',
                        marginBottom: isMobile ? '16px' : '32px',
                        background: '#f0f0f0',
                    }}>
                        <img
                            src={photoUrl}
                            alt={spotting.registration}
                            style={{
                                width: '100%',
                                display: 'block',
                                objectFit: 'contain',
                                maxHeight: isMobile ? '280px' : '600px',
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
                <div style={{ marginBottom: '16px' }}>
                    {isMobile ? (
                        <>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '6px',
                            }}>
                                <h1 style={{
                                    fontSize: '22px', fontWeight: 700,
                                    letterSpacing: '-0.5px', margin: 0,
                                }}>
                                    {spotting.registration || '—'}
                                </h1>
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
                                    }}
                                >
                                    👍 {spotting.likes || 0}
                                </button>
                            </div>
                            <p style={{ fontSize: '16px', color: '#555', margin: '0 0 2px' }}>
                                {spotting.airline?.airlineName || '—'}
                            </p>
                            <p style={{ fontSize: '13px', color: '#888', margin: '0 0 6px' }}>
                                {spotting.aircraft?.icaoCode || ''} · {spotting.aircraft?.typeName || '—'}
                            </p>
                            <p style={{ fontSize: '13px', color: '#555', margin: '0 0 4px' }}>
                                📍 {spotting.spotLocation?.airportName || '—'}
                                {spotting.spotLocation?.iataCode && ` (${spotting.spotLocation.iataCode})`}
                            </p>
                            <p style={{ fontSize: '12px', color: '#999', margin: 0 }}>
                                {spotting.notes || '—'}
                            </p>
                        </>
                    ) : (
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: '16px',
                        }}>
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
                    )}
                </div>

                {/* Split-flap display */}
                <div style={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    justifyContent: 'space-between',
                    gap: isMobile ? '10px' : '0px',
                    marginBottom: '16px',
                }}>
                    <div style={{
                        background: '#0a0a0a',
                        borderRadius: '10px',
                        padding: isMobile ? '10px 14px' : '14px 18px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                        border: '1px solid #222',
                    }}>
                        <SplitFlapRow label="Flight" value={spotting.flight?.flightNumber} maxLen={6} small={isMobile} />
                    </div>

                    <div style={{
                        background: '#0a0a0a',
                        borderRadius: '10px',
                        padding: isMobile ? '10px 14px' : '14px 18px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                        border: '1px solid #222',
                    }}>
                        <SplitFlapRow label="From" value={spotting.flight?.departureAirport} maxLen={12} small={isMobile} />
                    </div>

                    <div style={{
                        background: '#0a0a0a',
                        borderRadius: '10px',
                        padding: isMobile ? '10px 14px' : '14px 18px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                        border: '1px solid #222',
                    }}>
                        <SplitFlapRow label="To" value={spotting.flight?.arrivalAirport} maxLen={12} small={isMobile} />
                    </div>
                </div>
            </div>
        </div>
    );
}
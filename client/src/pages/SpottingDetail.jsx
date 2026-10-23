import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import GateDisplay from '../components/GateDisplay';

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

                {/* Gate display */}
                <GateDisplay spotting={spotting} isMobile={isMobile} />

                {/* Notes | Like button */}
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                    gap: '16px', margin: '16px 0',
                }}>
                    <p style={{ fontSize: isMobile ? '12px' : '13px', color: '#999', margin: 0 }}>
                        {spotting.notes || ''}
                    </p>
                    <button
                        onClick={handleLike}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            flexShrink: 0,
                            padding: isMobile ? '6px 14px' : '8px 18px',
                            background: liked ? '#1a1a2e' : '#f8f8fa',
                            border: '1px solid #eee',
                            borderRadius: '24px',
                            cursor: liked ? 'default' : 'pointer',
                            fontSize: isMobile ? '14px' : '15px',
                            fontWeight: 600,
                            color: liked ? '#fff' : '#333',
                            transition: 'all 0.15s',
                            fontFamily: "'DM Sans', sans-serif",
                        }}
                    >
                        👍 {spotting.likes || 0}
                    </button>
                </div>
            </div>
        </div>
    );
}
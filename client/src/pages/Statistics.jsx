import { useState, useEffect } from 'react';
import api from '../api/axios';

export default function Statistics() {
  const [stats, setStats] = useState(null);
  const [spottings, setSpottings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [statsRes, spottingsRes] = await Promise.all([
        api.get('/spotting/stats'),
        api.get('/spotting/all'),
      ]);
      setStats(statsRes.data);
      setSpottings(spottingsRes.data);
    } catch (err) {
      console.error('Failed to fetch stats', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <p style={{ color: '#888', fontSize: '15px' }}>Loading...</p>;
  if (!stats) return <p style={{ color: '#888' }}>Failed to load statistics.</p>;

  const totalLikes = spottings.reduce((sum, s) => sum + (s.likes || 0), 0);
  const totalSpottings = stats.total;
  const totalAirlines = stats.filters?.airlines?.length || 0;
  const totalAircraft = stats.filters?.aircraft?.length || 0;
  const totalAirports = stats.filters?.airports?.length || 0;

  // Most spotted airlines
  const airlineCounts = {};
  spottings.forEach(s => {
    if (!s.airline) return;
    const name = s.airline.airlineName;
    airlineCounts[name] = (airlineCounts[name] || 0) + 1;
  });
  const topAirlines = Object.entries(airlineCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  // Most spotted aircraft
  const aircraftCounts = {};
  spottings.forEach(s => {
    if (!s.aircraft) return;
    const code = s.aircraft.icaoCode;
    aircraftCounts[code] = (aircraftCounts[code] || 0) + 1;
  });
  const topAircraft = Object.entries(aircraftCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  // Most liked spottings
  const topLiked = [...spottings]
    .sort((a, b) => (b.likes || 0) - (a.likes || 0))
    .slice(0, 3);

  // Monthly activity
  const monthCounts = stats.monthCounts || {};
  const monthKeys = Object.keys(monthCounts).sort();
  const maxMonth = Math.max(...Object.values(monthCounts), 1);

  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <div style={{ width: '100%' }}>
      <div style={{
        background: '#fff',
        borderRadius: '8px',
        border: '1px solid #eee',
        padding: '32px',
      }}>
        <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '28px', letterSpacing: '-0.3px' }}>
          Statistics
        </h2>

        {/* Overview cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '16px',
          marginBottom: '36px',
        }}>
          <StatCard label="Spottings" value={totalSpottings} />
          <StatCard label="Total Likes" value={totalLikes} />
          <StatCard label="Airlines" value={totalAirlines} />
          <StatCard label="Aircraft Types" value={totalAircraft} />
          <StatCard label="Airports" value={totalAirports} />
        </div>

        {/* Monthly activity */}
        <div style={{ marginBottom: '36px' }}>
          <h3 style={sectionTitle}>Monthly Activity</h3>
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: '8px',
            height: '160px',
            padding: '0 4px',
          }}>
            {monthKeys.map(key => {
              const count = monthCounts[key];
              const height = (count / maxMonth) * 140;
              const monthIdx = parseInt(key.slice(5)) - 1;
              const label = `${MONTH_NAMES[monthIdx]} '${key.slice(2, 4)}`;

              return (
                <div key={key} style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#333' }}>
                    {count}
                  </span>
                  <div style={{
                    width: '100%',
                    maxWidth: '48px',
                    height: `${height}px`,
                    background: '#1a1a2e',
                    borderRadius: '4px 4px 0 0',
                    transition: 'height 0.5s ease',
                  }} />
                  <span style={{ fontSize: '10px', color: '#888', whiteSpace: 'nowrap' }}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '24px',
        }}>
          {/* Top airlines */}
          <div>
            <h3 style={sectionTitle}>Top Airlines</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {topAirlines.map(([name, count], i) => (
                <div key={name} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}>
                  <span style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: i === 0 ? '#1a1a2e' : '#e8e8eb',
                    color: i === 0 ? '#fff' : '#555',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}>{i + 1}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '4px',
                    }}>
                      <span style={{ fontSize: '13px', fontWeight: 500, color: '#333' }}>{name}</span>
                      <span style={{ fontSize: '13px', color: '#888' }}>{count}</span>
                    </div>
                    <div style={{
                      height: '4px',
                      background: '#f0f0f0',
                      borderRadius: '2px',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${(count / topAirlines[0][1]) * 100}%`,
                        background: i === 0 ? '#1a1a2e' : '#bbb',
                        borderRadius: '2px',
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top aircraft */}
          <div>
            <h3 style={sectionTitle}>Top Aircraft</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {topAircraft.map(([code, count], i) => (
                <div key={code} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}>
                  <span style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: i === 0 ? '#1a1a2e' : '#e8e8eb',
                    color: i === 0 ? '#fff' : '#555',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}>{i + 1}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '4px',
                    }}>
                      <span style={{ fontSize: '13px', fontWeight: 500, color: '#333' }}>{code}</span>
                      <span style={{ fontSize: '13px', color: '#888' }}>{count}</span>
                    </div>
                    <div style={{
                      height: '4px',
                      background: '#f0f0f0',
                      borderRadius: '2px',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${(count / topAircraft[0][1]) * 100}%`,
                        background: i === 0 ? '#1a1a2e' : '#bbb',
                        borderRadius: '2px',
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Most liked */}
          <div>
            <h3 style={sectionTitle}>Most Liked</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {topLiked.map((s, i) => (
                <div key={s.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}>
                  <span style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: i === 0 ? '#1a1a2e' : '#e8e8eb',
                    color: i === 0 ? '#fff' : '#555',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}>{i + 1}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}>
                      <span style={{ fontSize: '13px', fontWeight: 500, color: '#333' }}>
                        {s.registration} · {s.airline?.airlineName || '—'}
                      </span>
                      <span style={{ fontSize: '13px', color: '#888' }}>
                        👍 {s.likes || 0}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div style={{
      background: '#f8f8fa',
      borderRadius: '10px',
      padding: '20px',
      textAlign: 'center',
      border: '1px solid #eee',
    }}>
      <p style={{
        fontSize: '28px',
        fontWeight: 700,
        color: '#1a1a2e',
        margin: '0 0 4px',
      }}>{value}</p>
      <p style={{
        fontSize: '12px',
        fontWeight: 600,
        color: '#888',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        margin: 0,
      }}>{label}</p>
    </div>
  );
}

const sectionTitle = {
  fontSize: '14px',
  fontWeight: 600,
  color: '#888',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  marginBottom: '16px',
};
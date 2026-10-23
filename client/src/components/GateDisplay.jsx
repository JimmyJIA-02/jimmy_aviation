import { Fragment, useState, useEffect, useLayoutEffect, useRef } from 'react';
import api from '../api/axios';

const NAME_DURATION = 4000; // ms each language stays on screen
const DEFAULT_BRAND = [59, 130, 246];
const NAVY = '#0e1a2e';
const MUTED = '#8796ad';
const DIVIDER = '1px solid rgba(255,255,255,0.08)';
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const REDUCE_MOTION = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const PLANE_PATH = 'M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z';

function PlaneIcon({ size, rotate = 0 }) {
    return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor"
            style={{ transform: `rotate(${rotate}deg)`, flexShrink: 0 }} aria-hidden="true">
            <path d={PLANE_PATH} />
        </svg>
    );
}

// Flights saved before airport codes were used hold a city name instead
const isIataCode = (value) => /^[A-Z]{3}$/.test(value || '');

function formatDate(iso) {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${d} ${MONTHS[Number(m) - 1]} ${y}`;
}

function languageName(lang) {
    try {
        return new Intl.DisplayNames([lang], { type: 'language' }).of(lang);
    } catch {
        return lang.toUpperCase();
    }
}

// Most common saturated colour in the logo, ignoring transparent, white, grey and black pixels
function dominantColour(img) {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const buckets = new Map();
    for (let i = 0; i < px.length; i += 4) {
        const [r, g, b, a] = [px[i], px[i + 1], px[i + 2], px[i + 3]];
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        if (a < 128 || max < 50 || (max - min) / max < 0.35) continue;
        const key = (r >> 5) << 6 | (g >> 5) << 3 | (b >> 5);
        const s = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 };
        s.n++; s.r += r; s.g += g; s.b += b;
        buckets.set(key, s);
    }
    let best = null;
    for (const s of buckets.values()) if (!best || s.n > best.n) best = s;
    if (!best || best.n < 20) return null;
    return [best.r / best.n, best.g / best.n, best.b / best.n].map(Math.round);
}

function useAirportInfo(code) {
    const [state, setState] = useState({ code: null, info: null });

    useEffect(() => {
        if (!isIataCode(code)) return;
        let cancelled = false;
        api.get(`/airport-info/${code}`)
            .then(res => !cancelled && setState({ code, info: res.data }))
            .catch(() => { });
        return () => { cancelled = true; };
    }, [code]);

    return state.code === code ? state.info : null;
}

// Logo served by our own server; brand colour is picked from it
function useAirlineLogo(icao) {
    const [state, setState] = useState({ icao: null, ok: false, rgb: null });

    useEffect(() => {
        if (!icao) return;
        const img = new Image();
        img.onload = () => setState({ icao, ok: true, rgb: dominantColour(img) });
        img.onerror = () => setState({ icao, ok: false, rgb: null });
        img.src = `/api/airline/${icao}/logo`;
        return () => { img.onload = img.onerror = null; };
    }, [icao]);

    return state.icao === icao ? state : { ok: false, rgb: null };
}

// "Singapore/Changi" in English first, then the city in each local language
function placeVersions(stored, info) {
    if (!info) return [{ lang: 'en', label: stored || '—' }];
    const name = info.shortName && info.shortName !== info.city
        ? `${info.city}/${info.shortName}`
        : info.city;
    return [{ lang: 'en', label: name }, ...(info.localNames || [])];
}

// Each "City/Airport" part stays whole; a line may only break after the slash
function Segmented({ text }) {
    const parts = text.split('/');
    return parts.map((part, i) => (
        <Fragment key={i}>
            {i > 0 && <wbr />}
            <span style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>
                {part.trim()}{i < parts.length - 1 ? '/' : ''}
            </span>
        </Fragment>
    ));
}

function Place({ label, versions, delay, align, nameRef }) {
    const [state, setState] = useState({ index: 0, prev: -1 });
    const count = versions.length;

    useEffect(() => {
        if (count < 2) return;
        let interval;
        const step = () => setState(s => ({ index: (s.index + 1) % count, prev: s.index }));
        const timeout = setTimeout(() => {
            step();
            interval = setInterval(step, NAME_DURATION);
        }, delay);
        return () => { clearTimeout(timeout); clearInterval(interval); };
    }, [count, delay]);

    const index = state.index < count ? state.index : 0;
    const current = versions[index];

    return (
        <div style={{ minWidth: 0, textAlign: align }}>
            <p style={{
                fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase',
                color: MUTED, fontWeight: 600, margin: '0 0 4px',
            }}>
                {label}
                <span style={{
                    marginLeft: '6px', color: '#cdd6e6', letterSpacing: '1px', textTransform: 'none',
                    opacity: current.lang !== 'en' ? 1 : 0, transition: 'opacity .5s',
                }}>
                    {current.lang !== 'en' && `· ${languageName(current.lang)}`}
                </span>
            </p>
            {/* every version sits in the same grid cell, so the height never jumps */}
            <p ref={nameRef} style={{
                display: 'grid', overflow: 'hidden', margin: 0,
                fontWeight: 800, letterSpacing: '-0.5px', lineHeight: 1.1,
            }}>
                {versions.map((v, i) => {
                    const shown = i === index;
                    const offset = REDUCE_MOTION || shown ? 'none'
                        : i === state.prev ? 'translateY(-45%)' : 'translateY(45%)';
                    return (
                        <span key={v.lang + v.label} lang={v.lang} dir="auto" aria-hidden={!shown} style={{
                            gridArea: '1 / 1',
                            opacity: shown ? 1 : 0,
                            transform: offset,
                            transition: 'opacity .5s ease, transform .5s ease',
                        }}>
                            {i === 0 ? <Segmented text={v.label} /> : v.label}
                        </span>
                    );
                })}
            </p>
        </div>
    );
}

export default function GateDisplay({ spotting, isMobile }) {
    const flight = spotting.flight;
    const airlineIcao = spotting.airline?.icaoCode;
    const fromInfo = useAirportInfo(flight?.departureAirport);
    const toInfo = useAirportInfo(flight?.arrivalAirport);
    const logo = useAirlineLogo(airlineIcao);

    const fromVersions = placeVersions(flight?.departureAirport, fromInfo);
    const toVersions = placeVersions(flight?.arrivalAirport, toInfo);

    const cardRef = useRef(null);
    const fromRef = useRef(null);
    const toRef = useRef(null);

    const [r, g, b] = logo.rgb || DEFAULT_BRAND;
    const brand = `rgb(${r},${g},${b})`;
    const onBrand = (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? NAVY : '#fff';

    // Shrink From and To together until no unbreakable part overflows, so both stay the same size
    const namesKey = [...fromVersions, ...toVersions].map(v => v.label).join('|');
    useLayoutEffect(() => {
        const base = isMobile ? 26 : 36;
        const fit = () => {
            const names = [fromRef.current, toRef.current].filter(Boolean);
            let size = base;
            names.forEach(n => { n.style.fontSize = `${size}px`; });
            while (size > 16 && names.some(n => n.scrollWidth > n.clientWidth + 1)) {
                size -= 1;
                names.forEach(n => { n.style.fontSize = `${size}px`; });
            }
        };
        fit();
        const observer = new ResizeObserver(fit);
        observer.observe(cardRef.current);
        document.fonts?.ready.then(fit);
        return () => observer.disconnect();
    }, [isMobile, namesKey]);

    const pad = isMobile ? '18px' : '24px';
    const smallLabel = {
        display: 'block', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase',
        color: MUTED, fontWeight: 600, marginBottom: '3px',
    };
    const ellipsis = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 };
    const cell = { padding: isMobile ? '10px 18px' : '12px 24px', minWidth: 0 };
    const cellValue = { fontSize: '14px', fontWeight: 600, color: '#e6ecf5', margin: 0, ...ellipsis };

    const spot = spotting.spotLocation;

    return (
        <div>
            <div ref={cardRef} style={{
                display: 'flex',
                background: NAVY,
                borderRadius: '14px',
                overflow: 'hidden',
                boxShadow: '0 10px 30px rgba(14,26,46,0.35)',
                color: '#fff',
            }}>
                <div style={{ width: '10px', flexShrink: 0, background: brand, transition: 'background .4s' }} />
                <div style={{ flex: 1, minWidth: 0 }}>

                    {/* Logo, airline, date */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: `14px ${pad}`, borderBottom: DIVIDER,
                    }}>
                        <div style={{
                            width: '40px', height: '40px', flexShrink: 0, background: '#fff', borderRadius: '9px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                            color: MUTED,
                        }}>
                            {logo.ok
                                ? <img src={`/api/airline/${airlineIcao}/logo`} alt=""
                                    style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
                                : <PlaneIcon size={22} />}
                        </div>
                        <span style={{ flex: 1, fontSize: '15px', fontWeight: 600, color: '#cdd6e6', ...ellipsis }}>
                            {spotting.airline?.airlineName || '—'}
                        </span>
                        <span style={{
                            fontSize: '13px', fontWeight: 600, color: MUTED,
                            letterSpacing: '1px', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
                        }}>
                            {formatDate(spotting.spotDate)}
                        </span>
                    </div>

                    {/* Flight, From ✈ To */}
                    <div style={{
                        display: 'flex',
                        flexDirection: isMobile ? 'column' : 'row',
                        alignItems: isMobile ? 'stretch' : 'center',
                        gap: isMobile ? '16px' : '28px',
                        padding: pad,
                    }}>
                        <div style={{
                            flexShrink: 0, alignSelf: isMobile ? 'flex-start' : 'auto',
                            background: '#fff', color: NAVY, borderRadius: '10px',
                            padding: '10px 16px', textAlign: 'center',
                        }}>
                            <small style={{ display: 'block', fontSize: '10px', letterSpacing: '2px', fontWeight: 700, color: MUTED }}>
                                FLIGHT
                            </small>
                            <b style={{ fontSize: isMobile ? '22px' : '30px', fontWeight: 800, letterSpacing: '1px' }}>
                                {flight?.flightNumber || '—'}
                            </b>
                        </div>
                        <div style={{
                            flex: 1, minWidth: 0, display: 'grid', alignItems: 'center',
                            gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) auto minmax(0, 1fr)',
                            gap: isMobile ? '6px' : '18px',
                        }}>
                            <Place label="From" versions={fromVersions} delay={NAME_DURATION} align="left" nameRef={fromRef} />
                            <div style={{ display: 'flex', alignItems: 'center', color: brand, transition: 'color .4s' }}>
                                {!isMobile && <i style={{ width: '28px', borderTop: '2px dashed rgba(255,255,255,0.25)' }} />}
                                <span style={{ margin: isMobile ? 0 : '0 6px', display: 'flex' }}>
                                    <PlaneIcon size={26} rotate={isMobile ? 180 : 90} />
                                </span>
                                {!isMobile && <i style={{ width: '28px', borderTop: '2px dashed rgba(255,255,255,0.25)' }} />}
                            </div>
                            {/* To flips half a cycle after From, so the board never changes all at once */}
                            <Place label="To" versions={toVersions} delay={NAME_DURATION * 1.5}
                                align={isMobile ? 'left' : 'right'} nameRef={toRef} />
                        </div>
                    </div>

                    {/* Aircraft, registration, spot location */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)',
                        borderTop: DIVIDER,
                    }}>
                        <div style={cell}>
                            <small style={smallLabel}>Aircraft</small>
                            <p style={cellValue}>
                                {[spotting.aircraft?.icaoCode, spotting.aircraft?.typeName].filter(Boolean).join(' · ') || '—'}
                            </p>
                        </div>
                        <div style={{ ...cell, borderLeft: DIVIDER }}>
                            <small style={smallLabel}>Registration</small>
                            <p style={cellValue}>{spotting.registration || '—'}</p>
                        </div>
                        <div style={{
                            ...cell,
                            ...(isMobile ? { gridColumn: '1 / 3', borderTop: DIVIDER } : { borderLeft: DIVIDER }),
                        }}>
                            <small style={smallLabel}>Spotted at</small>
                            <p style={cellValue}>
                                {spot?.airportName || '—'}{spot?.iataCode && ` (${spot.iataCode})`}
                            </p>
                        </div>
                    </div>

                    <div style={{
                        padding: `9px ${pad}`, background: brand, color: onBrand,
                        fontSize: '12px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase',
                        transition: 'background .4s, color .4s',
                    }}>
                        ● Spotted
                    </div>
                </div>
            </div>
            <p style={{ fontSize: '11px', color: '#aaa', margin: '8px 2px 0' }}>
                Airline names and logos are trademarks of their respective owners, shown for identification only.
                Not affiliated with any airline.
            </p>
        </div>
    );
}

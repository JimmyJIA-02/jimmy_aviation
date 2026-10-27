import { useState, useEffect } from 'react';

// Airline logo (served by our own server) and the brand colour picked from it.
// Shared by the gate display and the route map cards.

export const airlineLogoUrl = (icao) => `/api/airline/${icao}/logo`;

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

// Colour picked from an airline's logo on an earlier visit, so it shows from the first frame.
// undefined = not known yet, null = logo has no usable colour
function cachedColour(icao) {
    try {
        const value = localStorage.getItem(`airlineColour:${icao}`);
        return value ? JSON.parse(value) : undefined;
    } catch {
        return undefined;
    }
}

function saveColour(icao, rgb) {
    try {
        localStorage.setItem(`airlineColour:${icao}`, JSON.stringify(rgb));
    } catch { /* private mode etc. */ }
}

// { status: 'loading' | 'ok' | 'failed', rgb: [r, g, b] | null | undefined }
export function useAirlineLogo(icao) {
    const [state, setState] = useState({ icao: null, status: 'loading', rgb: undefined });

    useEffect(() => {
        if (!icao) return;
        const img = new Image();
        img.onload = () => {
            const rgb = dominantColour(img);
            saveColour(icao, rgb);
            setState({ icao, status: 'ok', rgb });
        };
        img.onerror = () => setState({ icao, status: 'failed', rgb: null });
        img.src = airlineLogoUrl(icao);
        return () => { img.onload = img.onerror = null; };
    }, [icao]);

    if (!icao) return { status: 'failed', rgb: null };
    return state.icao === icao ? state : { status: 'loading', rgb: cachedColour(icao) };
}

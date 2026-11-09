import { useEffect, useRef } from 'react';

// Small aircraft drifting behind the guest pages, each with an ATC-style data box. Callsign, type and
// route come from the logbook's spottings; level, speed and climb rate are made up, as they aren't logged.

const ink = (a) => `rgba(26,26,46,${a})`;
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';
const COUNT = 6;

// spottings -> one entry per flight number + aircraft type + route
function flightsFrom(spottings) {
    const seen = new Map();
    for (const s of spottings) {
        const callsign = s.flight?.flightNumber?.trim();
        if (!callsign) continue;
        const flight = {
            callsign: callsign.toUpperCase(),
            type: s.aircraft?.icaoCode || '',
            from: s.flight?.departureAirport || '',
            to: s.flight?.arrivalAirport || '',
        };
        seen.set(`${flight.callsign}|${flight.type}|${flight.from}|${flight.to}`, flight);
    }
    return [...seen.values()];
}

export default function SkyBackground({ spottings }) {
    const canvasRef = useRef(null);
    const flightsRef = useRef([]);
    useEffect(() => { flightsRef.current = flightsFrom(spottings); }, [spottings]);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        let W, H, next = Math.floor(Math.random() * 1000), frame, last = performance.now();

        const resize = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            W = window.innerWidth; H = window.innerHeight;
            canvas.width = W * dpr; canvas.height = H * dpr;
            canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };

        // enters from an edge and heads roughly across (or, at the start, anywhere on screen)
        const spawn = (anywhere = false) => {
            const pool = flightsRef.current;
            if (!pool.length) return null;
            const f = pool[next++ % pool.length];
            const heading = Math.random() * Math.PI * 2;
            const r = Math.hypot(W, H) / 2 + 60;
            const x = anywhere ? Math.random() * W : W / 2 - Math.cos(heading) * r + (Math.random() - 0.5) * W * 0.6;
            const y = anywhere ? Math.random() * H : H / 2 - Math.sin(heading) * r + (Math.random() - 0.5) * H * 0.6;
            const level = 100 + Math.floor(Math.random() * 30) * 10; // FL100–FL390
            return {
                ...f, x, y, heading, speed: 14 + Math.random() * 10, level, target: level, vs: 0,
                gs: 380 + Math.round(Math.random() * 120), changeIn: 5 + Math.random() * 15,
            };
        };

        let planes = [];
        const step = (dt) => {
            // flights arrive after the page loads; fill up once they do
            while (planes.length < COUNT && flightsRef.current.length) planes.push(spawn(true));
            for (const p of planes) {
                p.x += Math.cos(p.heading) * p.speed * dt;
                p.y += Math.sin(p.heading) * p.speed * dt;
                // now and then a new cleared level, climbed or descended to
                p.changeIn -= dt;
                if (p.changeIn <= 0) {
                    p.changeIn = 10 + Math.random() * 20;
                    const change = (Math.random() < 0.5 ? -1 : 1) * (20 + Math.floor(Math.random() * 6) * 10);
                    p.target = Math.max(100, Math.min(410, p.level + change));
                }
                const diff = p.target - p.level;
                p.vs = Math.abs(diff) < 0.5 ? 0 : Math.sign(diff) * 1500; // ft/min
                p.level += Math.sign(diff) * Math.min(Math.abs(diff), 3 * dt);
            }
            planes = planes.map(p => (p.x < -150 || p.y < -150 || p.x > W + 150 || p.y > H + 150) ? spawn() : p);
        };

        const drawPlane = (p) => {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.heading);
            ctx.fillStyle = ink(0.55);
            ctx.beginPath(); // a tiny top-down airliner, nose to +x
            ctx.moveTo(9, 0); ctx.lineTo(6, -1.4); ctx.lineTo(1, -1.4); ctx.lineTo(-3, -8); ctx.lineTo(-5, -8);
            ctx.lineTo(-2, -1.4); ctx.lineTo(-6, -1.4); ctx.lineTo(-8, -4); ctx.lineTo(-9.5, -4); ctx.lineTo(-8.5, 0);
            ctx.lineTo(-9.5, 4); ctx.lineTo(-8, 4); ctx.lineTo(-6, 1.4); ctx.lineTo(-2, 1.4); ctx.lineTo(-5, 8);
            ctx.lineTo(-3, 8); ctx.lineTo(1, 1.4); ctx.lineTo(6, 1.4);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        };

        const drawTag = (p) => {
            const arrow = p.vs > 0 ? '↑' : p.vs < 0 ? '↓' : '';
            const rate = p.vs ? ` ${p.vs > 0 ? '+' : ''}${p.vs}` : '';
            const route = p.from && p.to ? `${p.from} → ${p.to}` : p.from || p.to;
            const lines = [
                [p.callsign, p.type],
                [`FL${String(Math.round(p.level)).padStart(3, '0')}${arrow}${rate}`, `${p.gs}kt`],
                ...(route ? [[route, '']] : []),
            ];
            const lineH = 13, padX = 6, padY = 5, gap = 10;
            ctx.font = `600 10px ${MONO}`;
            const widths = lines.map(([a, b]) => ctx.measureText(a).width + (b ? gap + ctx.measureText(b).width : 0));
            const w = Math.max(...widths) + padX * 2, h = lines.length * lineH + padY * 2 - 3;

            // the box sits up-right of the plane, joined by a leader line
            const bx = p.x + 18, by = p.y - 18 - h;
            ctx.strokeStyle = ink(0.25);
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(p.x + 5, p.y - 5); ctx.lineTo(bx, by + h); ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.75)';
            ctx.beginPath(); ctx.roundRect(bx, by, w, h, 3); ctx.fill(); ctx.stroke();

            ctx.textBaseline = 'top';
            lines.forEach(([a, b], i) => {
                const y = by + padY + i * lineH;
                ctx.fillStyle = ink(i === 0 ? 0.7 : 0.5);
                ctx.font = `${i === 0 ? 600 : 400} 10px ${MONO}`;
                ctx.textAlign = 'left';
                ctx.fillText(a, bx + padX, y);
                if (b) { ctx.textAlign = 'right'; ctx.fillText(b, bx + w - padX, y); }
            });
        };

        const draw = () => {
            ctx.clearRect(0, 0, W, H);
            for (const p of planes) { drawPlane(p); drawTag(p); }
        };

        const tick = (now) => {
            frame = requestAnimationFrame(tick);
            const dt = Math.min((now - last) / 1000, 0.1);
            last = now;
            step(dt);
            draw();
        };

        resize();
        frame = requestAnimationFrame(tick);
        const onVisibility = () => {
            cancelAnimationFrame(frame);
            if (!document.hidden) { last = performance.now(); frame = requestAnimationFrame(tick); }
        };
        window.addEventListener('resize', resize);
        document.addEventListener('visibilitychange', onVisibility);
        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener('resize', resize);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, []);

    return (
        <canvas ref={canvasRef} aria-hidden="true" style={{
            position: 'fixed', inset: 0, zIndex: -1, pointerEvents: 'none', display: 'block',
        }} />
    );
}

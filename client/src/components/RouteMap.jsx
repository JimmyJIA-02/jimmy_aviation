import { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import api from '../api/axios';
import { geocodeCity } from '../utils/geocode';
import { useAirlineLogo, airlineLogoUrl } from '../utils/airlineBrand';

const NAVY = '#1a1a2e';
const ACCENT = '#2563eb';
const OCEAN = '#f4f7fb';
const LAND = '#dce3ec';
const ROUTE_WIDTH = 1.5;
const ROUTE_OPACITY = 0.45;
const SAME_AIRPORT_KM = 30; // an older city name this close to a coded airport is the same airport
const EARTH_KM = 6371;
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const PLANE_PATH = 'M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z';
const REDUCE_MOTION = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Flights saved before airport codes were used hold a city name instead
const isIataCode = (value) => /^[A-Z]{3}$/.test(value || '');
const distanceKm = (p, q) => d3.geoDistance([p.lon, p.lat], [q.lon, q.lat]) * EARTH_KM;
const formatKm = (km) => `${Math.round(km).toLocaleString('en-AU')} km`;

function formatDate(iso) {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${d} ${MONTHS[Number(m) - 1]} ${y}`;
}

function formatRange(spottings) {
    const dates = spottings.map(s => s.spotDate).filter(Boolean).sort();
    if (!dates.length) return '—';
    const first = formatDate(dates[0]), last = formatDate(dates[dates.length - 1]);
    return first === last ? first : `${first} – ${last}`;
}

const photoSrc = (url) => !url ? null : url.startsWith('/api') ? url : `/api/photo/${url}`;

// One card per registration + flight number on a route, whatever the day; newest first.
// Spottings missing either stay on their own.
function groupByFlight(spottings) {
    const groups = new Map();
    for (const s of spottings) {
        const reg = (s.registration || '').trim().toUpperCase();
        const flight = (s.flight?.flightNumber || '').trim().toUpperCase();
        const key = reg && flight ? `${reg}|${flight}` : `id|${s.id}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(s);
    }
    return [...groups.entries()]
        .map(([key, list]) => {
            const sorted = [...list].sort((a, b) => (b.spotDate || '').localeCompare(a.spotDate || ''));
            return { key, spottings: sorted, latest: sorted[0] };
        })
        .sort((a, b) => (b.latest.spotDate || '').localeCompare(a.latest.spotDate || ''));
}

function useIsMobile() {
    const [isMobile, setIsMobile] = useState(window.innerWidth < 760);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 760);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return isMobile;
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// A code the server can't place answers 404. Anything else (server busy right after a restart,
// a proxy timeout, a dropped connection) is retried rather than leaving the airport off the map.
async function lookupAirport(code) {
    for (let attempt = 1; attempt <= 4; attempt++) {
        try {
            const { data } = await api.get(`/airport-info/${code}`, { params: { names: false } });
            return data.lat != null && data.lon != null
                ? { lat: data.lat, lon: data.lon, label: data.city || code, continent: data.continent }
                : null;
        } catch (err) {
            if (err.response?.status === 404 || attempt === 4) return null;
            await sleep(2000 * attempt);
        }
    }
    return null;
}

// Every departure/arrival value -> { lat, lon, label, continent }, or null if it can't be placed.
// Codes are all requested at once (the server queues its AeroDataBox calls); older city names go
// through geocodeCity, which paces its Nominatim searches.
function useResolvedPlaces(valuesKey) {
    const [places, setPlaces] = useState({});

    useEffect(() => {
        const values = valuesKey ? valuesKey.split('\n') : [];
        let cancelled = false;
        const store = (value, place) => {
            if (!cancelled) setPlaces(prev => ({ ...prev, [value]: place }));
        };

        values.filter(isIataCode).forEach(code => {
            lookupAirport(code).then(place => store(code, place));
        });

        (async () => {
            for (const name of values.filter(v => !isIataCode(v))) {
                if (cancelled) return;
                const coords = await geocodeCity(name);
                store(name, coords ? { lat: coords.lat, lon: coords.lng, label: name } : null);
            }
        })();

        return () => { cancelled = true; };
    }, [valuesKey]);

    return places;
}

// One airport per place (an older "Melbourne" merges into "MEL"), one route per airport pair
// with both directions together
function buildModel(spottings, places) {
    const coded = Object.entries(places).filter(([value, place]) => place && isIataCode(value));
    const canonical = {};
    for (const [value, place] of Object.entries(places)) {
        if (!place) continue;
        if (isIataCode(value)) {
            canonical[value] = value;
            continue;
        }
        const same = coded.find(([, p]) => distanceKm(p, place) < SAME_AIRPORT_KM);
        canonical[value] = same ? same[0] : value;
    }

    const airports = {};
    const grouped = new Map();
    // spottings left off the map, and why
    const skipped = { unplaced: new Map(), sameAirport: 0, noRoute: 0 };
    for (const s of spottings) {
        const dep = s.flight?.departureAirport;
        const arr = s.flight?.arrivalAirport;
        if (!dep || !arr) {
            skipped.noRoute++;
            continue;
        }
        const a = canonical[dep];
        const b = canonical[arr];
        if (!a || !b) {
            // null = looked up but couldn't be placed; undefined = still loading
            for (const value of [dep, arr]) {
                if (places[value] === null) skipped.unplaced.set(value, (skipped.unplaced.get(value) || 0) + 1);
            }
            continue;
        }
        if (a === b) {
            skipped.sameAirport++;
            continue;
        }
        for (const key of [a, b]) {
            if (!airports[key]) airports[key] = { key, ...places[key], count: 0 };
            airports[key].count++;
        }
        const key = [a, b].sort().join('|');
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(s);
    }

    const routes = [...grouped].map(([key, list]) => {
        const [a, b] = key.split('|');
        // drawn from the far end towards the busier airport, usually where it was spotted
        const [origin, home] = airports[a].count >= airports[b].count ? [b, a] : [a, b];
        const from = airports[origin], to = airports[home];
        return {
            key, origin, home, spottings: list, count: list.length,
            km: distanceKm(from, to),
            line: { type: 'LineString', coordinates: [[from.lon, from.lat], [to.lon, to.lat]] },
        };
    });

    return {
        airports,
        routes,
        skipped,
        maxRoute: d3.max(routes, r => r.count) || 1,
        maxAirport: d3.max(Object.values(airports), a => a.count) || 1,
    };
}

// ───────── drawing (d3 owns everything inside the svg groups) ─────────

function drawData(svg, view, model, onHover, onSelect) {
    const { path, projection } = view;

    svg.select('g.routes').selectAll('path').data(model.routes, r => r.key).join(
        enter => enter.append('path')
            .attr('fill', 'none')
            .attr('stroke', NAVY)
            .attr('stroke-width', ROUTE_WIDTH)
            .attr('stroke-opacity', ROUTE_OPACITY)
            .attr('stroke-linecap', 'round')
            .attr('vector-effect', 'non-scaling-stroke')
            .attr('d', r => path(r.line))
            .each(function () {
                if (REDUCE_MOTION) return;
                // draw the route in as soon as both of its airports are known
                const len = this.getTotalLength();
                d3.select(this)
                    .attr('stroke-dasharray', `${len} ${len}`).attr('stroke-dashoffset', len)
                    .transition('draw').duration(900).ease(d3.easeCubicOut).attr('stroke-dashoffset', 0)
                    .on('end', function () { d3.select(this).attr('stroke-dasharray', null).attr('stroke-dashoffset', null); });
            }),
        update => update.attr('d', r => path(r.line)),
    );

    // wide invisible lines on top, so thin routes are easy to hover and click
    svg.select('g.hits').selectAll('path').data(model.routes, r => r.key).join(
        enter => enter.append('path')
            .attr('fill', 'none')
            .attr('stroke', 'transparent')
            .attr('stroke-width', 12)
            .attr('vector-effect', 'non-scaling-stroke')
            .style('cursor', 'pointer')
            .on('mouseenter', (e, r) => onHover(r.key))
            .on('mouseleave', () => onHover(null))
            .on('click', (e, r) => onSelect(r.key)),
    ).attr('d', r => path(r.line));

    const airports = Object.values(model.airports);
    svg.select('g.dots').selectAll('circle').data(airports, a => a.key).join(
        enter => enter.append('circle')
            .attr('fill', NAVY)
            .attr('stroke', '#fff')
            .style('pointer-events', 'none'),
    )
        .attr('cx', a => projection([a.lon, a.lat])[0])
        .attr('cy', a => projection([a.lon, a.lat])[1]);

    svg.select('g.labels').selectAll('text').data(airports, a => a.key).join(
        enter => enter.append('text')
            .attr('fill', NAVY)
            .attr('stroke', OCEAN)
            .attr('stroke-linejoin', 'round')
            .style('paint-order', 'stroke')
            .style('font-family', "'DM Sans', sans-serif")
            .style('font-weight', 700)
            .style('pointer-events', 'none'),
    ).text(a => a.label);
}

// Dots and labels keep their on-screen size while zooming
function updateScaled(svg, view, model, active) {
    const k = view.k;
    svg.select('g.dots').selectAll('circle')
        .attr('r', a => (2.5 + 3.5 * Math.sqrt(a.count / model.maxAirport)) / k)
        .attr('stroke-width', 1.5 / k);
    svg.select('g.labels').selectAll('text')
        .attr('font-size', 11 / k)
        .attr('stroke-width', 3 / k);
    layoutLabels(svg, view, model, active);
}

// Busiest airports are labelled first; a label that would overlap one already placed is hidden.
// The ends of the highlighted route are always labelled.
function layoutLabels(svg, view, model, active) {
    const { transform: t, k, projection, width, height } = view;
    const route = active && model.routes.find(r => r.key === active);
    const forced = new Set(route ? [route.origin, route.home] : []);
    const rank = a => (forced.has(a.key) ? 1e6 : 0) + a.count;
    const nodes = svg.select('g.labels').selectAll('text').nodes()
        .sort((a, b) => rank(b.__data__) - rank(a.__data__));
    const placed = [];
    const gap = 9;

    for (const node of nodes) {
        const a = node.__data__;
        const [x, y] = projection([a.lon, a.lat]);
        const sx = t.applyX(x), sy = t.applyY(y);
        node.removeAttribute('display');
        const w = node.getComputedTextLength() * k;
        const right = sx + gap + w < width - 8; // near the right edge the label goes on the left
        const box = right ? [sx + gap, sy - 9, w, 14] : [sx - gap - w, sy - 9, w, 14];
        const inside = box[0] > 4 && box[1] > 4 && box[1] + box[3] < height - 4;
        const overlaps = placed.some(p => box[0] < p[0] + p[2] + 4 && p[0] < box[0] + box[2] + 4
            && box[1] < p[1] + p[3] && p[1] < box[1] + box[3]);

        if (forced.has(a.key) || (inside && !overlaps)) {
            placed.push(box);
            node.setAttribute('x', right ? x + gap / k : x - gap / k);
            node.setAttribute('y', y + 4 / k);
            node.setAttribute('text-anchor', right ? 'start' : 'end');
        } else {
            node.setAttribute('display', 'none');
        }
    }
}

function applyHighlight(svg, model, active) {
    const route = active && model.routes.find(r => r.key === active);
    const ends = new Set(route ? [route.origin, route.home] : []);
    const dim = key => !!active && !ends.has(key);

    svg.select('g.routes').selectAll('path')
        .attr('stroke', r => r.key === active ? ACCENT : NAVY)
        .attr('stroke-width', r => r.key === active ? 2.5 : ROUTE_WIDTH)
        .attr('stroke-opacity', r => !active ? ROUTE_OPACITY : r.key === active ? 1 : 0.1)
        .filter(r => r.key === active).raise();
    svg.select('g.dots').selectAll('circle').attr('opacity', a => dim(a.key) ? 0.2 : 1);
    svg.select('g.labels').selectAll('text').attr('opacity', a => dim(a.key) ? 0.2 : 1);
}

// ───────── component ─────────

export default function RouteMap({ spottings }) {
    const navigate = useNavigate();
    const isMobile = useIsMobile();

    const valuesKey = useMemo(() => [...new Set(spottings
        .flatMap(s => [s.flight?.departureAirport, s.flight?.arrivalAirport])
        .filter(Boolean))].sort().join('\n'), [spottings]);
    const places = useResolvedPlaces(valuesKey);
    const model = useMemo(() => buildModel(spottings, places), [spottings, places]);

    const [hover, setHover] = useState(null);
    const [selected, setSelected] = useState(null);
    const [size, setSize] = useState({ width: 0, height: 0 });
    const [world, setWorld] = useState(null);
    const [hint, setHint] = useState(false);
    // the stack opened on the selected route; ignored once another route is picked
    const [openGroup, setOpenGroup] = useState(null);
    const active = hover || selected;

    const cardRef = useRef(null);
    const svgRef = useRef(null);
    const planeRef = useRef(null);
    const detailRef = useRef(null);
    // projection, zoom state and size, used by d3 outside React's render
    const view = useRef({ k: 1, transform: d3.zoomIdentity, projection: null, path: null, zoom: null, width: 0, height: 0 });
    // latest model/highlight for the zoom handler
    const latest = useRef({ model, active });

    useLayoutEffect(() => {
        latest.current = { model, active };
    });

    // map follows its container, also on phones and window resizes
    useLayoutEffect(() => {
        const el = cardRef.current;
        const observer = new ResizeObserver(() => {
            const { width, height } = el.getBoundingClientRect();
            setSize(prev => Math.abs(prev.width - width) < 1 && Math.abs(prev.height - height) < 1
                ? prev : { width, height });
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        let cancelled = false;
        fetch('/world-50m.json')
            .then(res => res.json())
            .then(w => {
                if (cancelled) return;
                setWorld({
                    land: topojson.feature(w, w.objects.land),
                    borders: topojson.mesh(w, w.objects.countries, (a, b) => a !== b),
                });
            })
            .catch(err => console.error('World map failed to load', err));
        return () => { cancelled = true; };
    }, []);

    // projection, globe and zoom for the current size
    useLayoutEffect(() => {
        if (!size.width) return;
        const v = view.current;
        const svg = d3.select(svgRef.current);
        v.width = size.width;
        v.height = size.height;
        v.projection = d3.geoNaturalEarth1()
            .rotate([-150, 0])
            .fitExtent([[6, 6], [size.width - 6, size.height - 6]], { type: 'Sphere' });
        v.path = d3.geoPath(v.projection);
        svg.select('.sphere').attr('d', v.path({ type: 'Sphere' }));
        svg.select('.graticule').attr('d', v.path(d3.geoGraticule10()));

        if (!v.zoom) {
            const showHint = () => {
                setHint(true);
                clearTimeout(v.hintTimer);
                v.hintTimer = setTimeout(() => setHint(false), 1100);
            };
            // plain scrolling keeps scrolling the page; Ctrl/⌘ + scroll, trackpad pinch,
            // two-finger pinch, drag and the buttons zoom the map
            v.zoom = d3.zoom()
                .scaleExtent([1, 8])
                .filter(e => {
                    if (e.type === 'wheel') {
                        if (e.ctrlKey || e.metaKey) return true;
                        showHint();
                        return false;
                    }
                    if (e.type === 'touchstart') return e.touches.length > 1;
                    return !e.button;
                })
                .on('zoom', e => {
                    v.transform = e.transform;
                    v.k = e.transform.k;
                    svg.select('g.zoom').attr('transform', e.transform);
                    updateScaled(svg, v, latest.current.model, latest.current.active);
                });
            svg.call(v.zoom);
        }
        v.zoom.extent([[0, 0], [size.width, size.height]]).translateExtent([[0, 0], [size.width, size.height]]);
        svg.call(v.zoom.transform, d3.zoomIdentity);
    }, [size]);

    useLayoutEffect(() => {
        const v = view.current;
        if (!world || !v.path) return;
        const svg = d3.select(svgRef.current);
        svg.select('.land').attr('d', v.path(world.land));
        svg.select('.borders').attr('d', v.path(world.borders));
    }, [world, size]);

    // routes, dots and labels; new ones appear as their airports arrive
    useLayoutEffect(() => {
        const v = view.current;
        if (!v.path) return;
        const svg = d3.select(svgRef.current);
        drawData(svg, v, model, setHover, key => {
            setSelected(prev => prev === key ? null : key);
            setOpenGroup(null);
        });
        updateScaled(svg, v, model, latest.current.active);
        applyHighlight(svg, model, latest.current.active);
    }, [model, size]);

    // highlight + a small plane gliding along the route into the airport where it was spotted
    useEffect(() => {
        const v = view.current;
        if (!v.path) return;
        const svg = d3.select(svgRef.current);
        applyHighlight(svg, model, active);
        layoutLabels(svg, v, model, active);

        const plane = d3.select(planeRef.current);
        const route = active && model.routes.find(r => r.key === active);
        const node = route && svg.select('g.routes').selectAll('path').filter(r => r.key === active).node();
        if (!node || REDUCE_MOTION) {
            plane.attr('display', 'none');
            return;
        }
        const duration = Math.min(4000, Math.max(1400, route.km / 3));
        const start = performance.now();
        let frame;
        const fly = (now) => {
            const len = node.getTotalLength();
            const at = Math.max(0, Math.min(len - 0.6, d3.easeCubicInOut(((now - start) % duration) / duration) * len));
            const p = node.getPointAtLength(at), q = node.getPointAtLength(at + 0.5);
            const angle = Math.atan2(q.y - p.y, q.x - p.x) * 180 / Math.PI;
            plane.attr('display', null)
                .attr('transform', `translate(${p.x},${p.y}) rotate(${angle + 90}) scale(${0.85 / v.k}) translate(-12,-12)`);
            frame = requestAnimationFrame(fly);
        };
        frame = requestAnimationFrame(fly);
        return () => {
            cancelAnimationFrame(frame);
            plane.attr('display', 'none');
        };
    }, [active, model]);

    useEffect(() => {
        if (selected && isMobile) detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, [selected, isMobile]);

    const zoomBy = (factor) => {
        const zoom = view.current.zoom;
        if (zoom) d3.select(svgRef.current).transition().duration(300).call(zoom.scaleBy, factor);
    };
    const resetZoom = () => {
        const zoom = view.current.zoom;
        if (zoom) d3.select(svgRef.current).transition().duration(400).call(zoom.transform, d3.zoomIdentity);
    };
    const toggleSelected = (key) => {
        setSelected(prev => prev === key ? null : key);
        setOpenGroup(null);
    };

    const total = valuesKey ? valuesKey.split('\n').length : 0;
    const loaded = valuesKey ? valuesKey.split('\n').filter(v => v in places).length : 0;
    const label = (key) => model.airports[key]?.label || key;
    const sortedRoutes = [...model.routes].sort((a, b) => b.count - a.count || b.km - a.km);
    const selectedRoute = selected && model.routes.find(r => r.key === selected);
    const groups = selectedRoute ? groupByFlight(selectedRoute.spottings) : [];
    const shownGroup = openGroup?.route === selected ? groups.find(g => g.key === openGroup.key) : null;
    const aircraftCount = selectedRoute
        ? new Set(selectedRoute.spottings.map(s => (s.registration || '').trim().toUpperCase() || s.id)).size : 0;

    const missing = spottings.length - d3.sum(model.routes, r => r.count);
    const stats = (() => {
        if (!model.routes.length) return null;
        const airports = Object.values(model.airports);
        const continents = new Set(airports.map(a => a.continent).filter(Boolean));
        const longest = d3.greatest(model.routes, r => r.km);
        return {
            spottings: d3.sum(model.routes, r => r.count),
            routes: model.routes.length,
            airports: airports.length,
            continents: continents.size,
            longest,
        };
    })();

    const statStyle = { fontWeight: 700, color: NAVY, fontVariantNumeric: 'tabular-nums' };
    const controlButton = {
        width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#fff',
        fontSize: '16px', fontWeight: 600, color: NAVY, cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,.06)',
        fontFamily: "'DM Sans', sans-serif",
    };

    return (
        <div style={{ marginBottom: '32px' }}>
            {/* Stats */}
            <div style={{
                display: 'flex', flexWrap: 'wrap', gap: '4px 18px', fontSize: '13px', color: '#777',
                marginBottom: '14px', minHeight: '20px',
            }}>
                {stats && (
                    <>
                        <span><b style={statStyle}>{stats.spottings}</b> spottings</span>
                        <span><b style={statStyle}>{stats.routes}</b> routes</span>
                        <span><b style={statStyle}>{stats.airports}</b> airports</span>
                        {stats.continents > 0 && <span><b style={statStyle}>{stats.continents}</b> continents</span>}
                        <span>
                            Longest: <b style={statStyle}>{label(stats.longest.origin)} ↔ {label(stats.longest.home)}</b>{' '}
                            {formatKm(stats.longest.km)}
                        </span>
                    </>
                )}
            </div>

            {/* Spottings that couldn't be drawn, once everything has loaded */}
            {loaded === total && missing > 0 && (
                <p style={{ fontSize: '12px', color: '#9a6b00', margin: '-6px 0 14px' }}>
                    {missing} of {spottings.length} spottings aren't on the map
                    {model.skipped.unplaced.size > 0 && (
                        <> · couldn't place {[...model.skipped.unplaced]
                            .sort((a, b) => b[1] - a[1])
                            .map(([value, count]) => `${value} (${count})`)
                            .join(', ')}</>
                    )}
                    {model.skipped.sameAirport > 0 && <> · {model.skipped.sameAirport} with the same departure and arrival</>}
                    {model.skipped.noRoute > 0 && <> · {model.skipped.noRoute} without a departure or arrival</>}
                </p>
            )}

            <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) 300px',
                gap: '16px',
            }}>
                {/* Map */}
                <div ref={cardRef} style={{
                    position: 'relative', height: isMobile ? '320px' : '460px',
                    border: '1px solid #eee', borderRadius: '12px', overflow: 'hidden', background: OCEAN,
                }}>
                    <svg ref={svgRef} viewBox={`0 0 ${size.width || 1} ${size.height || 1}`}
                        aria-label="Map of spotted routes"
                        style={{ display: 'block', width: '100%', height: '100%', cursor: 'grab', touchAction: 'pan-y' }}>
                        <g className="zoom">
                            <path className="sphere" fill={OCEAN} />
                            <path className="graticule" fill="none" stroke="#e2e8f0" strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
                            <path className="land" fill={LAND} />
                            <path className="borders" fill="none" stroke={OCEAN} strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
                            <g className="routes" />
                            <g className="hits" />
                            <g className="dots" />
                            <g className="labels" />
                            <path ref={planeRef} d={PLANE_PATH} fill={ACCENT} display="none" style={{ pointerEvents: 'none' }} />
                        </g>
                    </svg>

                    {loaded < total && (
                        <div style={{
                            position: 'absolute', top: '12px', left: '12px', fontSize: '12px', fontWeight: 600, color: '#666',
                            background: '#fff', borderRadius: '999px', padding: '5px 12px', boxShadow: '0 2px 8px rgba(0,0,0,.08)',
                        }}>
                            Loading airports {loaded}/{total}
                        </div>
                    )}

                    <div style={{ position: 'absolute', right: '12px', bottom: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <button style={controlButton} onClick={() => zoomBy(1.6)} title="Zoom in">+</button>
                        <button style={controlButton} onClick={() => zoomBy(1 / 1.6)} title="Zoom out">−</button>
                        <button style={controlButton} onClick={resetZoom} title="Reset view">⟲</button>
                    </div>

                    <div style={{
                        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(26,26,46,.35)', color: '#fff', fontSize: '14px', fontWeight: 600,
                        opacity: hint ? 1 : 0, pointerEvents: 'none', transition: 'opacity .25s',
                    }}>
                        Hold Ctrl (⌘ on Mac) and scroll to zoom
                    </div>
                </div>

                {/* Top routes */}
                <div style={{
                    height: isMobile ? 'auto' : '460px', maxHeight: isMobile ? '340px' : 'none',
                    border: '1px solid #eee', borderRadius: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden',
                }}>
                    <h3 style={{
                        fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#888', fontWeight: 700,
                        margin: 0, padding: '14px 16px 10px', borderBottom: '1px solid #f0f0f0',
                    }}>Top routes</h3>
                    <div style={{ overflowY: 'auto', flex: 1 }} onMouseLeave={() => setHover(null)}>
                        {sortedRoutes.map(r => {
                            const isActive = r.key === active;
                            return (
                                <button key={r.key}
                                    onMouseEnter={() => setHover(r.key)}
                                    onClick={() => toggleSelected(r.key)}
                                    style={{
                                        display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '3px 10px', width: '100%',
                                        padding: '10px 16px', border: 0, borderBottom: '1px solid #f5f5f5',
                                        background: isActive ? '#f6f8fb' : 'none', textAlign: 'left', cursor: 'pointer',
                                        fontFamily: "'DM Sans', sans-serif", color: NAVY,
                                    }}>
                                    <span style={{ fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {label(r.origin)} ↔ {label(r.home)}
                                    </span>
                                    <span style={{ fontSize: '13px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{r.count}</span>
                                    <span style={{ gridColumn: '1 / 3', fontSize: '11px', color: '#999' }}>
                                        {r.origin} · {r.home} · {formatKm(r.km)}
                                    </span>
                                    <span style={{ gridColumn: '1 / 3', height: '4px', background: '#eef1f5', borderRadius: '2px', overflow: 'hidden' }}>
                                        <i style={{
                                            display: 'block', height: '100%', borderRadius: '2px',
                                            width: `${(r.count / model.maxRoute) * 100}%`,
                                            background: isActive ? ACCENT : NAVY, transition: 'width .4s',
                                        }} />
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Spottings on the selected route */}
            {selectedRoute && (
                <div ref={detailRef} style={{ marginTop: '16px', border: '1px solid #eee', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                        {shownGroup ? (
                            <div>
                                <button onClick={() => setOpenGroup(null)} style={{
                                    background: 'none', border: 0, padding: 0, marginBottom: '6px', cursor: 'pointer',
                                    fontSize: '12px', fontWeight: 600, color: ACCENT, fontFamily: "'DM Sans', sans-serif",
                                }}>
                                    ← {label(selectedRoute.origin)} ↔ {label(selectedRoute.home)}
                                </button>
                                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: NAVY }}>
                                    {shownGroup.latest.registration} · {shownGroup.latest.flight?.flightNumber}
                                    <span style={{ fontSize: '14px', fontWeight: 500, color: '#999' }}>
                                        {shownGroup.latest.airline?.airlineName && ` · ${shownGroup.latest.airline.airlineName}`}
                                        {shownGroup.latest.aircraft?.icaoCode && ` · ${shownGroup.latest.aircraft.icaoCode}`}
                                    </span>
                                </h3>
                                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#888' }}>
                                    {shownGroup.spottings.length} spottings
                                    {' · '}{shownGroup.latest.flight?.departureAirport} → {shownGroup.latest.flight?.arrivalAirport}
                                    {' · '}{formatRange(shownGroup.spottings)}
                                </p>
                            </div>
                        ) : (
                            <div>
                                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: NAVY }}>
                                    {label(selectedRoute.origin)} ↔ {label(selectedRoute.home)}
                                </h3>
                                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#888' }}>
                                    {selectedRoute.origin} – {selectedRoute.home} · {formatKm(selectedRoute.km)}
                                    {' · '}{selectedRoute.count} spotting{selectedRoute.count > 1 ? 's' : ''}
                                    {' of '}{aircraftCount} aircraft
                                </p>
                            </div>
                        )}
                        <button onClick={() => toggleSelected(selected)} aria-label="Close" style={{
                            background: 'none', border: 0, fontSize: '18px', color: '#999', cursor: 'pointer', padding: '0 4px',
                        }}>✕</button>
                    </div>
                    <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '12px', marginTop: '14px',
                    }}>
                        {shownGroup
                            ? shownGroup.spottings.map(s => (
                                <RouteCard key={s.id} spotting={s} showPhoto onOpen={() => navigate(`/spotting/${s.id}`)} />
                            ))
                            : groups.map(g => (
                                <RouteCard key={g.key} spotting={g.latest} stack={g.spottings}
                                    onOpen={() => g.spottings.length > 1
                                        ? setOpenGroup({ route: selected, key: g.key })
                                        : navigate(`/spotting/${g.latest.id}`)} />
                            ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// two card edges peeking out behind a stack
const STACK_SHADOW = '3px 3px 0 -1px #fff, 3px 3px 0 0 #e3e3e3, 6px 6px 0 -1px #fff, 6px 6px 0 0 #ececec';

// The airline's logo as a faded watermark on a light wash of its colour. With `stack`, the card stands for
// several spottings of one aircraft and flight; with `showPhoto`, it shows the spotting's own photo instead.
function RouteCard({ spotting, stack, showPhoto, onOpen }) {
    const icao = spotting.airline?.icaoCode;
    const logo = useAirlineLogo(icao);
    const [hovered, setHovered] = useState(false);
    const [r, g, b] = logo.rgb || [135, 150, 173];
    const brand = `rgb(${r},${g},${b})`;
    const many = stack?.length > 1;
    const photo = showPhoto && photoSrc(spotting.photoUrl);
    const lift = hovered ? '0 6px 16px rgba(0,0,0,.08)' : null;

    return (
        <a href={`/spotting/${spotting.id}`}
            onClick={(e) => { e.preventDefault(); onOpen(); }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            title={many ? `Show all ${stack.length} spottings of ${spotting.registration} as ${spotting.flight?.flightNumber}` : undefined}
            style={{
                textDecoration: 'none', color: 'inherit', border: '1px solid #eee', borderRadius: '10px', overflow: 'hidden',
                background: '#fff', margin: many ? '0 6px 6px 0' : 0,
                transform: hovered ? 'translateY(-2px)' : 'none',
                boxShadow: [many && STACK_SHADOW, lift].filter(Boolean).join(', ') || 'none',
                transition: 'transform .15s, box-shadow .15s',
            }}>
            <div style={{
                aspectRatio: '16 / 10', position: 'relative', overflow: 'hidden', color: NAVY, borderRadius: '10px 10px 0 0',
                background: `linear-gradient(135deg, color-mix(in srgb, ${brand} 6%, #fff), color-mix(in srgb, ${brand} 18%, #fff))`,
            }}>
                {photo && (
                    <>
                        <img src={photo} alt={`${spotting.registration || 'Aircraft'} spotted ${formatDate(spotting.spotDate)}`}
                            loading="lazy" style={{
                                position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
                                transform: hovered ? 'scale(1.03)' : 'none', transition: 'transform .3s',
                            }} />
                        {/* keeps the airline name and registration readable over the photo */}
                        <div style={{
                            position: 'absolute', inset: 0, pointerEvents: 'none',
                            background: 'linear-gradient(rgba(0,0,0,.35), transparent 35%, transparent 55%, rgba(0,0,0,.55))',
                        }} />
                    </>
                )}
                {!photo && logo.status === 'ok' && (
                    // the whole logo, uncut and no bigger than its 90px source so it stays sharp
                    <img src={airlineLogoUrl(icao)} alt="" style={{
                        position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                        height: '70%', maxHeight: '90px', aspectRatio: '1', objectFit: 'contain',
                        opacity: hovered ? 0.35 : 0.22, transition: 'opacity .2s', pointerEvents: 'none',
                    }} />
                )}
                <small style={{
                    position: 'absolute', top: '9px', left: '10px', right: many ? '86px' : '10px', fontSize: '10px', letterSpacing: '1px',
                    fontWeight: 700, color: photo ? '#fff' : `color-mix(in srgb, ${brand} 75%, ${NAVY})`,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                    {(spotting.airline?.airlineName || '').toUpperCase()}
                </small>
                <span style={{
                    position: 'absolute', left: '10px', bottom: '8px', fontSize: '18px', fontWeight: 800, letterSpacing: '1px',
                    color: photo ? '#fff' : NAVY,
                }}>
                    {spotting.registration || '—'}
                </span>
                {many && (
                    <span style={{
                        position: 'absolute', right: '8px', top: '6px', fontSize: '10px', fontWeight: 700, letterSpacing: '.5px',
                        background: NAVY, color: '#fff', borderRadius: '999px', padding: '3px 8px',
                    }}>
                        {stack.length} spottings
                    </span>
                )}
            </div>
            <div style={{ padding: '8px 10px 10px', fontSize: '12px', color: '#777', lineHeight: 1.5 }}>
                <b style={{ color: NAVY, fontSize: '13px' }}>{spotting.flight?.flightNumber || '—'}</b>
                {spotting.aircraft?.icaoCode && ` · ${spotting.aircraft.icaoCode}`}
                <br />
                {many ? formatRange(stack) : formatDate(spotting.spotDate)}
                {' · '}{spotting.flight?.departureAirport} → {spotting.flight?.arrivalAirport}
            </div>
        </a>
    );
}

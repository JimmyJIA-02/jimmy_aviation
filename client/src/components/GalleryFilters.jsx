import { useState, useEffect } from 'react';
import { SPOTTING_TAGS, tagInfo } from '../utils/spottingTags';
import { continentName, countryName, flagUrl, continentOf } from '../utils/geo';
import { EMPTY_FILTERS, facetCounts, toggleCountry, toggleContinent } from '../utils/galleryFilters';

const NAVY = '#1a1a2e';
const ACCENT = '#2563eb';
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function useIsMobile() {
    const [isMobile, setIsMobile] = useState(window.innerWidth < 760);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 760);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return isMobile;
}

// how a picked value reads in the pills above the grid
function pickLabel(facet, value) {
    if (facet === 'tag') return tagInfo(value)?.label || value;
    if (facet === 'airline') {
        return `Airlines from ${value.startsWith('C:') ? continentName(value.slice(2)) : countryName(value)}`;
    }
    if (facet === 'at') return `Spotted at ${value}`;
    return value;
}

// Side sheet on desktop, bottom sheet on phones. Every option shows how many spottings it would give
// with the other filters kept; options that would give none fade out
export function FilterSheet({ open, onClose, rows, filters, onChange, resultCount }) {
    const isMobile = useIsMobile();
    const [expanded, setExpanded] = useState([]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e) => e.key === 'Escape' && onClose();
        document.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = '';
        };
    }, [open, onClose]);

    const set = (facet, picked) => onChange({ ...filters, [facet]: picked });
    const toggle = (facet, value) => set(facet, filters[facet].includes(value)
        ? filters[facet].filter(v => v !== value)
        : [...filters[facet], value]);

    const tagCounts = facetCounts(rows, filters, 'tag');
    const aircraftCounts = facetCounts(rows, filters, 'aircraft');
    const airlineCounts = facetCounts(rows, filters, 'airline');
    const atCounts = facetCounts(rows, filters, 'at');

    // Every value any spotting has stays listed, biggest overall first, so options don't jump around or
    // vanish while filtering; the ones the current picks rule out just fade
    const listed = (facet) => {
        const totals = facetCounts(rows, EMPTY_FILTERS, facet);
        return [...new Set([...totals.keys(), ...filters[facet]])]
            .sort((a, b) => (totals.get(b) || 0) - (totals.get(a) || 0) || a.localeCompare(b));
    };

    // airline countries grouped under their continent, biggest first
    const airlineValues = listed('airline');
    const countries = airlineValues.filter(v => !v.startsWith('C:'));
    const continents = airlineValues.filter(v => v.startsWith('C:'))
        .map(key => ({ key, code: key.slice(2), countries: countries.filter(c => `C:${continentOf(c)}` === key) }));

    const chip = (facet, value, label, counts, icon) => {
        const on = filters[facet].includes(value);
        const n = counts.get(value) || 0;
        return (
            <button key={value} onClick={() => toggle(facet, value)} aria-pressed={on} style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px',
                borderRadius: '999px', border: `1px solid ${on ? NAVY : '#ddd'}`,
                background: on ? NAVY : '#fff', color: on ? '#fff' : '#333',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                opacity: !n && !on ? 0.35 : 1, transition: 'all .12s',
            }}>
                {icon && <span>{icon}</span>}
                {label}
                <span style={{ fontSize: '11px', color: on ? '#9aa3b5' : '#aaa', fontVariantNumeric: 'tabular-nums' }}>{n}</span>
            </button>
        );
    };

    const reset = (facet) => filters[facet].length > 0 && (
        <button onClick={() => set(facet, [])} style={{
            background: 'none', border: 0, color: ACCENT, fontSize: '12px', fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit', padding: 0,
        }}>Reset</button>
    );

    const usedTags = listed('tag');
    const tags = SPOTTING_TAGS.filter(t => usedTags.includes(t.key));
    const aircraft = listed('aircraft');
    const airports = listed('at');

    return (
        <>
            <div onClick={onClose} style={{
                position: 'fixed', inset: 0, background: 'rgba(15,18,30,.35)', zIndex: 20,
                opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none', transition: 'opacity .2s',
            }} />
            <aside aria-label="Filters" aria-hidden={!open} style={{
                position: 'fixed', zIndex: 21, background: '#fff', display: 'flex', flexDirection: 'column',
                fontFamily: "'DM Sans', sans-serif", transition: 'transform .25s ease',
                visibility: open ? 'visible' : 'hidden',
                ...(isMobile
                    ? { left: 0, right: 0, bottom: 0, height: '86vh', borderRadius: '16px 16px 0 0',
                        transform: open ? 'none' : 'translateY(100%)', boxShadow: '0 -12px 32px rgba(0,0,0,.12)' }
                    : { top: 0, right: 0, bottom: 0, width: '440px', maxWidth: '100%',
                        transform: open ? 'none' : 'translateX(100%)', boxShadow: '-12px 0 32px rgba(0,0,0,.12)' }),
            }}>
                <header style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '20px 24px 14px', borderBottom: '1px solid #f0f0f0',
                }}>
                    <h2 style={{ margin: 0, fontSize: '18px', color: NAVY }}>Filters</h2>
                    <button onClick={onClose} aria-label="Close" style={{
                        background: 'none', border: 0, fontSize: '20px', color: '#999', cursor: 'pointer',
                    }}>✕</button>
                </header>

                <div style={{ flex: 1, overflowY: 'auto', padding: '4px 24px 24px' }}>
                    <Section title="Category" action={reset('tag')}>
                        {tags.length
                            ? <Chips>{tags.map(t => chip('tag', t.key, t.label, tagCounts, t.icon))}</Chips>
                            : <Empty>No categories yet.</Empty>}
                    </Section>

                    <Section title="Aircraft" action={reset('aircraft')}>
                        <Chips>{aircraft.map(code => chip('aircraft', code, code, aircraftCounts))}</Chips>
                    </Section>

                    <Section title="Airline from" action={reset('airline')}>
                        {!continents.length && <Empty>No airline countries yet.</Empty>}
                        {continents.map(({ code, key, countries: codes }) => {
                            const whole = filters.airline.includes(key);
                            const some = codes.some(c => filters.airline.includes(c));
                            const isOpen = expanded.includes(key);
                            return (
                                <div key={key}>
                                    <TreeRow
                                        label={continentName(code)}
                                        count={airlineCounts.get(key) || 0}
                                        checked={whole}
                                        mixed={!whole && some}
                                        onCheck={() => set('airline', toggleContinent(filters.airline, key, codes))}
                                        open={isOpen}
                                        onExpand={() => setExpanded(isOpen ? expanded.filter(k => k !== key) : [...expanded, key])}
                                    />
                                    {isOpen && (
                                        <div style={{ paddingLeft: '24px' }}>
                                            {codes.map(c => (
                                                <TreeRow key={c}
                                                    label={countryName(c)}
                                                    flag={flagUrl(c)}
                                                    count={airlineCounts.get(c) || 0}
                                                    checked={whole || filters.airline.includes(c)}
                                                    onCheck={() => set('airline', toggleCountry(filters.airline, key, c, codes))}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </Section>

                    <Section title="Spotted at" action={reset('at')}>
                        <Chips>{airports.map(code => chip('at', code, code, atCounts))}</Chips>
                    </Section>
                </div>

                <footer style={{ display: 'flex', gap: '8px', padding: '14px 24px', borderTop: '1px solid #f0f0f0' }}>
                    <button onClick={() => onChange(EMPTY_FILTERS)} style={{
                        flex: 1, padding: '11px', borderRadius: '8px', border: 0, background: '#f5f5f5',
                        color: '#333', fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit',
                    }}>Clear all</button>
                    <button onClick={onClose} style={{
                        flex: 2, padding: '11px', borderRadius: '8px', border: 0, background: NAVY,
                        color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                    }}>Show {plural(resultCount, 'spotting')}</button>
                </footer>
            </aside>
        </>
    );
}

// Picked filters as removable pills, with how many spottings are left
export function ActiveFilters({ filters, onChange, shown, total }) {
    const picks = Object.entries(filters).flatMap(([facet, values]) => values.map(value => [facet, value]));
    if (!picks.length) return null;

    return (
        <div style={{
            maxWidth: '1200px', margin: '14px auto 0', padding: '0 16px',
            display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center',
        }}>
            <span style={{ fontSize: '13px', color: '#888', marginRight: '4px' }}>{shown} of {total}</span>
            {picks.map(([facet, value]) => (
                <button key={facet + value}
                    onClick={() => onChange({ ...filters, [facet]: filters[facet].filter(v => v !== value) })}
                    aria-label={`Remove ${pickLabel(facet, value)}`}
                    style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 8px 5px 12px',
                        borderRadius: '999px', background: NAVY, color: '#fff', border: 0, cursor: 'pointer',
                        fontSize: '12px', fontWeight: 600, fontFamily: 'inherit',
                    }}>
                    {pickLabel(facet, value)}
                    <span style={{ opacity: 0.7, fontSize: '14px', lineHeight: 1 }}>×</span>
                </button>
            ))}
            <button onClick={() => onChange(EMPTY_FILTERS)} style={{
                background: 'none', border: 0, color: '#888', fontSize: '12px', fontWeight: 600,
                cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit',
            }}>Clear all</button>
        </div>
    );
}

function Section({ title, action, children }) {
    return (
        <section style={{ borderBottom: '1px solid #f2f2f2', padding: '16px 0' }}>
            <h3 style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 10px',
                fontSize: '12px', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.8px',
            }}>
                {title}
                {action}
            </h3>
            {children}
        </section>
    );
}

const Chips = ({ children }) => <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>{children}</div>;

const Empty = ({ children }) => <p style={{ margin: 0, fontSize: '13px', color: '#aaa' }}>{children}</p>;

// A checkbox row; with onExpand it also opens and closes the rows under it
function TreeRow({ label, flag, count, checked, mixed, onCheck, open, onExpand }) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', fontSize: '14px',
            opacity: !count && !checked ? 0.35 : 1,
        }}>
            {onExpand && (
                <button onClick={onExpand} aria-label={open ? `Hide ${label}` : `Show ${label}`} aria-expanded={open}
                    style={{ width: '16px', padding: 0, background: 'none', border: 0, color: '#aaa', fontSize: '11px', cursor: 'pointer' }}>
                    {open ? '▾' : '▸'}
                </button>
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, cursor: 'pointer' }}>
                <input type="checkbox" checked={checked} onChange={onCheck}
                    ref={el => { if (el) el.indeterminate = !!mixed; }}
                    style={{ width: '16px', height: '16px', margin: 0, accentColor: NAVY, cursor: 'pointer' }} />
                {flag && <img src={flag} alt="" style={{ width: '18px', height: '13px', borderRadius: '2px', objectFit: 'cover' }} />}
                <span>{label}</span>
                <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#aaa', fontVariantNumeric: 'tabular-nums' }}>{count}</span>
            </label>
        </div>
    );
}

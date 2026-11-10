import { useState, useId } from 'react';
import { COUNTRY_OPTIONS, countryName, normalizeCountry } from '../utils/geo';

const MAX_SUGGESTIONS = 8;

const fold = (text) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// "china" -> China first, then names with a word starting "china" (Hong Kong SAR, China, Taiwan, China…),
// then any other name containing it; the two-letter code ("au") and short forms ("uk") also work
function suggest(query) {
    const q = fold(query);
    if (!q) return [];
    const alias = fold(normalizeCountry(query));
    const rank = ({ code, name }) => {
        const n = fold(name);
        if (code.toLowerCase() === q || n === alias) return 0;
        if (n.startsWith(q)) return 1;
        if (n.split(/[\s,]+/).some(word => word.startsWith(q))) return 2;
        if (n.includes(q)) return 3;
        return null;
    };
    return COUNTRY_OPTIONS
        .map(option => ({ ...option, rank: rank(option) }))
        .filter(option => option.rank !== null)
        .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name))
        .slice(0, MAX_SUGGESTIONS);
}

// Type a country and pick a suggestion (mouse, or arrows + Enter). The value is the ISO code, e.g. "HK"
export default function CountryInput({ value, onChange, placeholder, style }) {
    const listId = useId();
    // what's being typed; null while not editing, when the chosen country's name shows
    const [query, setQuery] = useState(null);
    const [active, setActive] = useState(0);

    const suggestions = query === null ? [] : suggest(query);
    const open = suggestions.length > 0;

    const choose = (code) => {
        onChange(code);
        setQuery(null);
    };

    // leaving the box: an exact name or code is taken, an empty box clears it, anything else goes back
    const commit = () => {
        if (query === null) return;
        if (!query.trim()) return choose('');
        const best = suggestions[0];
        if (best && best.rank === 0) return choose(best.code);
        setQuery(null);
    };

    const onKeyDown = (e) => {
        if (!open) return;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const step = e.key === 'ArrowDown' ? 1 : -1;
            setActive((active + step + suggestions.length) % suggestions.length);
        } else if (e.key === 'Enter') {
            e.preventDefault(); // pick, don't submit the form
            choose(suggestions[active].code);
        } else if (e.key === 'Escape') {
            setQuery(null);
        }
    };

    return (
        <div style={{ position: 'relative' }}>
            <input
                role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list"
                aria-activedescendant={open ? `${listId}-${active}` : undefined}
                value={query ?? countryName(value)}
                placeholder={placeholder}
                onChange={(e) => { setQuery(e.target.value); setActive(0); }}
                onFocus={(e) => e.target.select()}
                onBlur={commit}
                onKeyDown={onKeyDown}
                style={style}
            />
            {open && (
                <ul id={listId} role="listbox" style={{
                    position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 5,
                    margin: 0, padding: '4px', listStyle: 'none', background: '#fff',
                    border: '1px solid #ddd', borderRadius: '6px', boxShadow: '0 8px 24px rgba(0,0,0,.1)',
                }}>
                    {suggestions.map((option, i) => (
                        <li key={option.code} id={`${listId}-${i}`} role="option" aria-selected={i === active}
                            // mousedown, so the pick lands before the input's blur
                            onMouseDown={(e) => { e.preventDefault(); choose(option.code); }}
                            onMouseEnter={() => setActive(i)}
                            style={{
                                display: 'flex', justifyContent: 'space-between', gap: '8px',
                                padding: '8px 10px', borderRadius: '4px', fontSize: '14px', cursor: 'pointer',
                                background: i === active ? '#f2f3f7' : 'transparent',
                            }}>
                            <span>{option.name}</span>
                            <span style={{ color: '#aaa', fontSize: '12px' }}>{option.code}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

import { continentOf } from './geo';

// Each facet lists the values a spotting has for it. A spotting passes a facet with picks when it has
// one of the picked values (Asia or Oceania); it must pass every facet (Asia and Cargo).
// An airline country also counts towards its continent, kept as "C:<continent>" so a whole continent
// can be picked as one.
export const FACETS = {
    tag: s => [...(s.tags || [])],
    aircraft: s => s.aircraft?.icaoCode ? [s.aircraft.icaoCode] : [],
    airline: s => {
        const code = s.airline?.countryCode;
        const continent = continentOf(code);
        return code ? [code, ...(continent ? [`C:${continent}`] : [])] : [];
    },
    at: s => s.spotLocation?.iataCode ? [s.spotLocation.iataCode] : [],
};

export const EMPTY_FILTERS = Object.fromEntries(Object.keys(FACETS).map(f => [f, []]));

export const hasFilters = (filters) => Object.values(filters).some(picked => picked.length);

// spotting -> its values per facet, worked out once per spotting
export const facetRows = (spottings) => spottings.map(spotting => ({
    spotting,
    values: Object.fromEntries(Object.entries(FACETS).map(([f, get]) => [f, get(spotting)])),
}));

export const passes = (row, filters, except) => Object.entries(filters).every(([f, picked]) =>
    f === except || !picked.length || row.values[f].some(v => picked.includes(v)));

// how many spottings each value of a facet would give, with the other facets applied
export function facetCounts(rows, filters, facet) {
    const counts = new Map();
    for (const row of rows) {
        if (!passes(row, filters, facet)) continue;
        for (const v of new Set(row.values[facet])) counts.set(v, (counts.get(v) || 0) + 1);
    }
    return counts;
}

// Picking a continent replaces its countries; picking one country of a picked continent keeps the
// continent's other listed countries picked
export function toggleCountry(picked, continentKey, code, listedCodes) {
    if (picked.includes(code)) return picked.filter(v => v !== code);
    if (picked.includes(continentKey)) {
        return [...picked.filter(v => v !== continentKey), ...listedCodes.filter(c => c !== code)];
    }
    return [...picked, code];
}

export function toggleContinent(picked, continentKey, listedCodes) {
    if (picked.includes(continentKey)) return picked.filter(v => v !== continentKey);
    return [...picked.filter(v => !listedCodes.includes(v)), continentKey];
}

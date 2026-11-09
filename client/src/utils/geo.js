import { countries, continents } from 'countries-list';

// "OC" -> "Oceania"
export const continentName = (code) => continents[code] || code;

// "AU" -> "OC"
export const continentOf = (code) => countries[code]?.continent || null;

// the same names the spotting form uses for airports
const NAME_OVERRIDES = { HK: 'Hong Kong SAR, China', MO: 'Macau SAR, China', TW: 'Taiwan, China' };

export const countryName = (code) => NAME_OVERRIDES[code] || countries[code]?.name || code;

// every country, A–Z by name, for dropdowns
export const COUNTRY_OPTIONS = Object.keys(countries)
    .map(code => ({ code, name: countryName(code) }))
    .sort((a, b) => a.name.localeCompare(b.name));

// Taiwan uses the China flag
const FLAG_OVERRIDES = { TW: 'CN' };
export const flagUrl = (code) => {
    const flag = FLAG_OVERRIDES[code.toUpperCase()] || code;
    return `https://cdn.jsdelivr.net/npm/flag-icons@7.2.3/flags/4x3/${flag.toLowerCase()}.svg`;
};

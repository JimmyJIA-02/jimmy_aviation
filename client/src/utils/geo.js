import { countries, continents } from 'countries-list';

// "OC" -> "Oceania"
export const continentName = (code) => continents[code] || code;

// "AU" -> "OC"
export const continentOf = (code) => countries[code]?.continent || null;

// the same names the spotting form uses for airports
const NAME_OVERRIDES = { HK: 'Hong Kong SAR, China', MO: 'Macau SAR, China', TW: 'Taiwan, China' };

export const countryName = (code) => NAME_OVERRIDES[code] || countries[code]?.name || code;

// Airport countries are typed in; common short forms become the names used across the site
const COUNTRY_ALIASES = {
    'usa': 'United States', 'us': 'United States',
    'uk': 'United Kingdom', 'uae': 'United Arab Emirates',
    'nz': 'New Zealand', 'au': 'Australia',
    'sg': 'Singapore', 'jp': 'Japan',
    'cn': 'China', 'kr': 'South Korea',
    'hk': 'Hong Kong SAR, China', 'tw': 'Taiwan, China',
    'mo': 'Macau SAR, China',
    'america': 'United States', 'united states of america': 'United States',
    'britain': 'United Kingdom', 'great britain': 'United Kingdom',
    'england': 'United Kingdom',
    'hong kong': 'Hong Kong SAR, China', 'hongkong': 'Hong Kong SAR, China',
    'taiwan': 'Taiwan, China',
    'macau': 'Macau SAR, China', 'macao': 'Macau SAR, China',
    'korea': 'South Korea', 'south korea': 'South Korea',
    'emirates': 'United Arab Emirates',
};

export const normalizeCountry = (value) => COUNTRY_ALIASES[value.trim().toLowerCase()] || value;

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

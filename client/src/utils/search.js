import { countryName } from './geo';
import { tagInfo } from './spottingTags';

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'];

// lower case, no accents, letters and digits only: "VH-OQA" -> "vhoqa", "Nouméa" -> "noumea"
const normalize = (text) => String(text ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

// Everything a spotting can be found by, each field kept apart so a word can't match across two of them
export function searchFields(s) {
    const [year, month] = (s.spotDate || '').split('-');
    const monthName = MONTHS[Number(month) - 1];
    return [
        s.registration,
        s.flight?.flightNumber, s.flight?.departureAirport, s.flight?.arrivalAirport,
        s.aircraft?.icaoCode, s.aircraft?.typeName,
        s.airline?.airlineName, s.airline?.icaoCode, s.airline?.countryCode && countryName(s.airline.countryCode),
        s.spotLocation?.iataCode, s.spotLocation?.airportName, s.spotLocation?.city, s.spotLocation?.country,
        ...(s.tags || []).map(key => tagInfo(key)?.label),
        year, monthName, // "mar 2025" matches "march" and "2025"
        s.notes,
    ].map(normalize).filter(Boolean);
}

// "qantas a380" -> ["qantas", "a380"]; punctuation-only words are dropped
export const queryWords = (query) => query.split(/\s+/).map(normalize).filter(Boolean);

// every word must be found in some field ("qantas a380": an A380 that is also Qantas)
export const matchesQuery = (fields, words) => words.every(word => fields.some(field => field.includes(word)));

import api from '../api/axios';

// Shared by the spotting-locations map and the route map in the logbook

const coordsCache = {};

const KNOWN_AIRPORTS = {
    'Ho Chi Minh City': { lat: 10.819, lng: 106.652 }
};

export async function geocodeCity(cityName) {
    if (KNOWN_AIRPORTS[cityName]) return KNOWN_AIRPORTS[cityName];

    if (coordsCache[cityName]) return coordsCache[cityName];

    // Flights now store IATA codes; the server knows their exact location. It only answers for codes
    // used by a flight, so anything else (e.g. a spot location typed as "MEL") falls through to the
    // name search below, as before.
    if (/^[A-Z]{3}$/.test(cityName)) {
        try {
            // names=false: only the location is needed, so skip the slower translation lookup
            const { data } = await api.get(`/airport-info/${cityName}`, { params: { names: false } });
            if (data.lat != null && data.lon != null) {
                coordsCache[cityName] = { lat: data.lat, lng: data.lon };
                return coordsCache[cityName];
            }
        } catch {
            // not a flight's airport; try the name search
        }
    }

    // Check localStorage cache
    const cached = localStorage.getItem(`geo_${cityName}`);
    if (cached) {
        const parsed = JSON.parse(cached);
        coordsCache[cityName] = parsed;
        return parsed;
    }

    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cityName + ' airport')}&format=json&limit=1`
        );
        const data = await res.json();

        if (data.length > 0) {
            const coords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
            coordsCache[cityName] = coords;
            localStorage.setItem(`geo_${cityName}`, JSON.stringify(coords));
            return coords;
        }
    } catch (err) {
        console.error('Geocode failed for', cityName, err);
    }

    return null;
}

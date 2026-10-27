package com.jimmyaviation.website.service;

import com.jimmyaviation.website.dto.AeroDataBoxAirport;
import com.jimmyaviation.website.dto.AirportInfo;
import com.jimmyaviation.website.dto.AirportInfo.LocalName;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Resolves IATA codes stored on flights into airport details.
 * Results are kept in memory only (nothing is written to the database),
 * so each airport costs one AeroDataBox call per server start.
 */
@Service
@RequiredArgsConstructor
public class AirportInfoService {

    private final AeroDataBoxService aeroDataBoxService;
    private final WikidataService wikidataService;

    private final Map<String, Optional<AeroDataBoxAirport>> airports = new ConcurrentHashMap<>();
    private final Map<String, Object> lookupLocks = new ConcurrentHashMap<>();
    // by ICAO; only successful lookups are kept, so a busy Wikidata is retried on the next request
    private final Map<String, List<LocalName>> localNames = new ConcurrentHashMap<>();
    private final Map<String, String> wikidataNames = new ConcurrentHashMap<>();

    public static boolean isIataCode(String value) {
        return value != null && value.matches("[A-Z]{3}");
    }

    /**
     * @return the airport with its local-language names, or empty if the code is malformed or unknown to AeroDataBox
     * @throws RuntimeException if AeroDataBox can't be reached (not cached, so it's retried next time)
     */
    public Optional<AirportInfo> find(String iataCode) {
        return find(iataCode, true);
    }

    /**
     * @param withLocalNames false skips the Wikidata lookup, for callers that only need names and
     *                       location (route map, code checks on save)
     */
    public Optional<AirportInfo> find(String iataCode, boolean withLocalNames) {
        if (!isIataCode(iataCode)) {
            return Optional.empty();
        }

        Optional<AeroDataBoxAirport> airport = airports.get(iataCode);
        if (airport == null) {
            // one lookup per code: requests arriving together for the same airport wait for the first
            synchronized (lookupLocks.computeIfAbsent(iataCode, k -> new Object())) {
                airport = airports.get(iataCode);
                if (airport == null) {
                    airport = Optional.ofNullable(aeroDataBoxService.lookupAirport(iataCode));
                    airports.put(iataCode, airport);
                }
            }
        }
        return airport.map(a -> toInfo(a, withLocalNames));
    }

    private AirportInfo toInfo(AeroDataBoxAirport a, boolean withLocalNames) {
        String city = cityOf(a);
        return new AirportInfo(
                a.iata(),
                a.icao(),
                city,
                isBlank(a.shortName()) ? null : a.shortName(),
                a.fullName(),
                a.country() != null ? a.country().name() : null,
                a.continent() != null ? a.continent().name() : null,
                a.location() != null ? a.location().lat() : null,
                a.location() != null ? a.location().lon() : null,
                withLocalNames ? localNamesFor(a.icao(), city) : List.of());
    }

    // Some smaller airports have no names on AeroDataBox at all (MGB: municipality and shortName null,
    // fullName ""), so fall back to Wikidata's English name, then to the code itself; never null
    private String cityOf(AeroDataBoxAirport a) {
        for (String name : new String[] { a.municipalityName(), a.shortName(), a.fullName() }) {
            if (!isBlank(name)) return name;
        }
        if (a.icao() != null) {
            String cached = wikidataNames.get(a.icao());
            if (cached == null) {
                Optional<String> found = wikidataService.englishName(a.icao());
                found.ifPresent(name -> wikidataNames.put(a.icao(), name));
                cached = found.orElse("");
            }
            if (!cached.isBlank()) return cached;
        }
        return a.iata();
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private List<LocalName> localNamesFor(String icaoCode, String city) {
        if (icaoCode == null) {
            return List.of();
        }
        List<LocalName> cached = localNames.get(icaoCode);
        if (cached != null) {
            return cached;
        }
        Optional<List<LocalName>> names = wikidataService.localNames(icaoCode, city);
        names.ifPresent(found -> localNames.put(icaoCode, found));
        return names.orElse(List.of());
    }
}

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
    // by ICAO; only successful lookups are kept, so a busy Wikidata is retried on the next request
    private final Map<String, List<LocalName>> localNames = new ConcurrentHashMap<>();

    public static boolean isIataCode(String value) {
        return value != null && value.matches("[A-Z]{3}");
    }

    /**
     * @return the airport, or empty if the code is malformed or unknown to AeroDataBox
     * @throws RuntimeException if AeroDataBox can't be reached (not cached, so it's retried next time)
     */
    public Optional<AirportInfo> find(String iataCode) {
        if (!isIataCode(iataCode)) {
            return Optional.empty();
        }

        Optional<AeroDataBoxAirport> airport = airports.get(iataCode);
        if (airport == null) {
            airport = Optional.ofNullable(aeroDataBoxService.lookupAirport(iataCode));
            airports.put(iataCode, airport);
        }
        return airport.map(this::toInfo);
    }

    private AirportInfo toInfo(AeroDataBoxAirport a) {
        String city = a.municipalityName() != null ? a.municipalityName() : a.shortName();
        return new AirportInfo(
                a.iata(),
                a.icao(),
                city,
                a.shortName(),
                a.fullName(),
                a.country() != null ? a.country().name() : null,
                a.location() != null ? a.location().lat() : null,
                a.location() != null ? a.location().lon() : null,
                localNamesFor(a.icao(), city));
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

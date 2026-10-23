package com.jimmyaviation.website.service;

import com.jimmyaviation.website.dto.AeroDataBoxAirport;
import com.jimmyaviation.website.dto.AirportInfo;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

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

    private final Map<String, Optional<AirportInfo>> cache = new ConcurrentHashMap<>();

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

        Optional<AirportInfo> cached = cache.get(iataCode);
        if (cached != null) {
            return cached;
        }

        AeroDataBoxAirport airport = aeroDataBoxService.lookupAirport(iataCode);
        Optional<AirportInfo> info = Optional.ofNullable(airport).map(this::toInfo);
        cache.put(iataCode, info);
        return info;
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
                wikidataService.localCityNames(a.icao(), city));
    }
}

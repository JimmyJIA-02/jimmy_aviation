package com.jimmyaviation.website.dto;

import java.util.List;

// Airport details for the gate display and route map, resolved from an IATA code
public record AirportInfo(
        String iata,
        String icao,
        String city,
        String shortName,
        String fullName,
        String country,
        Double lat,
        Double lon,
        List<LocalName> localNames
) {

    // City name in one of its country's official languages, e.g. ("ms", "Singapura")
    public record LocalName(
            String lang,
            String label
    ) {}
}

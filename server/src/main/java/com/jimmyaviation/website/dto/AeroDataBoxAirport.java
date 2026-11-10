package com.jimmyaviation.website.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record AeroDataBoxAirport(
        String icao,
        String iata,
        String shortName,
        String fullName,
        String municipalityName,
        Location location,
        Country country,
        Continent continent
) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Continent(
            String code,
            String name
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Location(
            double lat,
            double lon
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Country(
            String code,
            String name
    ) {}
}

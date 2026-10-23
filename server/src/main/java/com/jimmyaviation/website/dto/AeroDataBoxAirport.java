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
        Country country
) {

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

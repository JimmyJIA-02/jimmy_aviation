package com.jimmyaviation.website.dto;

import java.util.List;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record AeroDataBoxResponse(
        List<Flight> arrivals,
        List<Flight> departures
) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Flight(
            Movement movement,
            String number,
            String callSign,
            String status,
            String codeshareStatus,
            boolean isCargo,
            AircraftInfo aircraft,
            AirlineInfo airline
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Movement(
            AirportInfo airport,
            TimeInfo scheduledTime,
            TimeInfo revisedTime,
            String terminal,
            String gate,
            List<String> quality
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record AirportInfo(
            String icao,
            String iata,
            String name,
            String countryCode
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record TimeInfo(
            String utc,
            String local
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record AircraftInfo(
            String reg,
            String modeS,
            String model
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record AirlineInfo(
            String name,
            String iata,
            String icao
    ) {}
}
package com.jimmyaviation.website.dto;

import java.time.LocalDate;

// An airport spotted from, for the Spotting Locations section.
// countryCode, mapName, lat and lon come from AeroDataBox and may be null if it couldn't be reached.
public record SpottingLocation(
        String iata,
        String name,
        String city,
        String country,
        String countryCode,
        String mapName,
        Double lat,
        Double lon,
        long count,
        LocalDate firstVisit,
        LocalDate lastVisit,
        String photoUrl
) {}

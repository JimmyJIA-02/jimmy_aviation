package com.jimmyaviation.website.dto;

import java.util.UUID;

// One airport for the admin airports page
public record AirportView(
        UUID id,
        String iataCode,
        String airportName,
        String city,
        String country,
        long spottings,
        String photoUrl
) {}

package com.jimmyaviation.website.dto;

// from the serverend to frontend rendering
public record PlannerFlight(
                String flightNumber,
                String callSign,
                String status,
                String registration,
                String aircraftModel,
                String airlineName,
                String connectedName,
                String scheduledTimeLocal,
                String direction) {
}
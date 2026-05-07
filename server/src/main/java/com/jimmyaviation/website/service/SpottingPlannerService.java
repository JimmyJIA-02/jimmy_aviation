package com.jimmyaviation.website.service;

import com.jimmyaviation.website.dto.AeroDataBoxResponse;
import com.jimmyaviation.website.dto.AeroDataBoxResponse.Flight;
import com.jimmyaviation.website.dto.PlannerFlight;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class SpottingPlannerService {

    private final AeroDataBoxService aeroDataBoxService;

    // Aircraft models that contain these keywords are widebodies
    // TODO: might need to refine
    private static final Set<String> WIDEBODY_KEYWORDS = Set.of(
            "A380", "A350", "A340", "A330",
            "747", "777", "787", "767");

    public Map<String, List<PlannerFlight>> getArrivals(String icaoCode, int offsetMinutes, int durationMinutes,
            boolean withCargo, boolean withPrivate) {
        AeroDataBoxResponse response = aeroDataBoxService.getPlanning(icaoCode, offsetMinutes, durationMinutes,
                withCargo, withPrivate);

        List<PlannerFlight> arrivals = processList(response.arrivals(), "arrival");
        List<PlannerFlight> departures = processList(response.departures(), "departure");

        return Map.of(
                "arrivals", arrivals,
                "departures", departures);
    }

    private List<PlannerFlight> processList(List<Flight> flights, String direction) {
        if (flights == null)
            return List.of();

        return flights.stream()
                .filter(f -> f.aircraft() != null && isWidebody(f.aircraft().model()))
                .map(f -> toFlight(f, direction))
                .sorted((a, b) -> {
                    String timeA = a.scheduledTimeLocal() != null ? a.scheduledTimeLocal() : "";
                    String timeB = b.scheduledTimeLocal() != null ? b.scheduledTimeLocal() : "";
                    return timeA.compareTo(timeB);
                })
                .toList();
    }

    private PlannerFlight toFlight(Flight flight, String direction) {
        var movement = flight.movement();
        var aircraft = flight.aircraft();
        var airline = flight.airline();
        var airport = movement != null ? movement.airport() : null;

        String model = aircraft != null ? aircraft.model() : null;

        return new PlannerFlight(
                flight.number(),
                flight.callSign(),
                flight.status(), // what are the values?
                aircraft != null ? aircraft.reg() : null,
                model,
                airline != null ? airline.name() : null,
                airport != null ? airport.name() : null,
                movement != null && movement.scheduledTime() != null ? movement.scheduledTime().local() : null,
                direction);
    }

    private boolean isWidebody(String model) {
        if (model == null)
            return false;
        String upper = model.toUpperCase();
        return WIDEBODY_KEYWORDS.stream().anyMatch(keyword -> upper.contains(keyword.toUpperCase()));
    }
}
package com.jimmyaviation.website.service;

import com.jimmyaviation.website.entity.*;
import com.jimmyaviation.website.repository.*;
import lombok.RequiredArgsConstructor;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.HashMap;
import java.util.Set;
import java.util.Map;
import java.time.LocalDate;

@Service
@RequiredArgsConstructor
public class GalleryService {

    private final SpottingRepository spottingRepository;
    private final AirlineRepository airlineRepository;
    private final AircraftRepository aircraftRepository;
    private final AirportRepository airportRepository;

    public List<Spotting> getAllSpottings() {
        return spottingRepository.findAll();
    }

    public Optional<Spotting> getSpottingById(UUID id) {
        return spottingRepository.findById(id);
    }

    public List<Spotting> getByAirline(UUID airlineId) {
        return spottingRepository.findByAirlineId(airlineId);
    }

    public List<Spotting> getByAircraft(UUID aircraftId) {
        return spottingRepository.findByAircraftId(aircraftId);
    }

    public List<Spotting> getByAirport(UUID airportId) {
        return spottingRepository.findBySpotLocation(airportId);
    }

    public List<Airline> getAllAirlines() {
        return airlineRepository.findAll();
    }

    public List<Aircraft> getAllAircraft() {
        return aircraftRepository.findAll();
    }

    public List<Airport> getAllAirports() {
        return airportRepository.findAll();
    }

    // thread safety *
    @Transactional
    public void likeSpotting(UUID spottingId) {
        spottingRepository.incrementLikes(spottingId);
    }

    public Page<Spotting> getAllSpottings(int page, int size) {
        return spottingRepository.findAll(
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "spotDate")));
    }

    public Map<String, Object> getStats() {
        List<Spotting> all = spottingRepository.findAll();

        Map<String, Long> monthCounts = all.stream()
                .filter(s -> s.getSpotDate() != null)
                .collect(Collectors.groupingBy(
                        s -> s.getSpotDate().toString().substring(0, 7),
                        Collectors.counting()
                ));

        Map<String, Map<String, Object>> locationCounts = new HashMap<>();
        for (Spotting s : all) {
            if (s.getSpotLocation() == null) continue;
            String id = s.getSpotLocation().getId().toString();
            if (!locationCounts.containsKey(id)) {
                Map<String, Object> loc = new HashMap<>();
                loc.put("name", s.getSpotLocation().getAirportName());
                loc.put("iata", s.getSpotLocation().getIataCode());
                loc.put("city", s.getSpotLocation().getCity());
                loc.put("country", s.getSpotLocation().getCountry());
                loc.put("count", 0L);
                locationCounts.put(id, loc);
            }
            locationCounts.get(id).put("count", (Long) locationCounts.get(id).get("count") + 1);
        }

        Set<Map<String, String>> airlines = all.stream()
                .filter(s -> s.getAirline() != null)
                .map(s -> Map.of("id", s.getAirline().getId().toString(), "name", s.getAirline().getAirlineName()))
                .collect(Collectors.toSet());

        Set<Map<String, String>> aircraft = all.stream()
                .filter(s -> s.getAircraft() != null)
                .map(s -> Map.of("id", s.getAircraft().getId().toString(), "icaoCode", s.getAircraft().getIcaoCode()))
                .collect(Collectors.toSet());

        Set<Map<String, String>> airports = all.stream()
                .filter(s -> s.getSpotLocation() != null)
                .map(s -> Map.of("id", s.getSpotLocation().getId().toString(), "iata", s.getSpotLocation().getIataCode()))
                .collect(Collectors.toSet());

        return Map.of(
                "monthCounts", monthCounts,
                "locations", locationCounts.values(),
                "filters", Map.of("airlines", airlines, "aircraft", aircraft, "airports", airports),
                "total", all.size()
        );
    }

    public List<Spotting> getByMonth(String month) {
        LocalDate start = LocalDate.parse(month + "-01");
        LocalDate end = start.plusMonths(1);
        return spottingRepository.findBySpotDateBetween(start, end.minusDays(1));
    }
}
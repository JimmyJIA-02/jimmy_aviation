package com.jimmyaviation.website.service;

import com.jimmyaviation.website.entity.*;
import com.jimmyaviation.website.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

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
}
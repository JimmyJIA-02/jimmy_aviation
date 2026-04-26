package com.jimmyaviation.website.service;

import com.jimmyaviation.website.entity.*;
import com.jimmyaviation.website.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

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

    public Optional<Spotting> getSpottingById(Integer id) {
        return spottingRepository.findById(id);
    }

    public List<Spotting> getByAirline(Integer airlineId) {
        return spottingRepository.findByAirlineId(airlineId);
    }

    public List<Spotting> getByAircraft(Integer aircraftId) {
        return spottingRepository.findByAircraftId(aircraftId);
    }

    public List<Spotting> getByAirport(Integer airportId) {
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
}
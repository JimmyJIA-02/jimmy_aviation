package com.jimmyaviation.website.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.jimmyaviation.website.entity.Spotting;
import java.time.LocalDate;


public interface SpottingRepository extends JpaRepository<Spotting, UUID> {
    List<Spotting> findByAirlineId(UUID airlineId);
    List<Spotting> findByAircraftId(UUID aircraftId);
    List<Spotting> findBySpotLocation(UUID AirportId);
    List<Spotting> findBySpotDate(LocalDate spotDate);
}

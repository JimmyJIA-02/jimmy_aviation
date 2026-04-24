package com.jimmyaviation.website.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.jimmyaviation.website.entity.Spotting;
import java.time.LocalDate;


public interface SpottingRepository extends JpaRepository<Spotting, Integer> {
    List<Spotting> findByAirlineId(Integer airlineId);
    List<Spotting> findByAircraftId(Integer aircraftId);
    List<Spotting> findBySpotLocation(Integer AirportId);
    List<Spotting> findBySpotDate(LocalDate spotDate);
}

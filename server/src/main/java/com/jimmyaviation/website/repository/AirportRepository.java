package com.jimmyaviation.website.repository;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.jimmyaviation.website.entity.Airport;

public interface AirportRepository extends JpaRepository<Airport, UUID> {
    // older airports were saved with the code as typed, so "mel" and "MEL" are the same airport
    Optional<Airport> findFirstByIataCodeIgnoreCase(String iataCode);
}

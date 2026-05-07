package com.jimmyaviation.website.repository;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.jimmyaviation.website.entity.Flight;

public interface FlightRepository extends JpaRepository<Flight, UUID> {
    Optional<Flight> findByFlightNumber(String flightNumber);
}

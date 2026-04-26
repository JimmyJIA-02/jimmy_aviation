package com.jimmyaviation.website.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.jimmyaviation.website.entity.Flight;

public interface FlightRepository extends JpaRepository<Flight, Integer> {
    Optional<Flight> findByFlightNumber(String flightNumber);
}

package com.jimmyaviation.website.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.jimmyaviation.website.entity.Airport;

public interface AirportRepository extends JpaRepository<Airport, Integer> {
    Optional<Airport> findByIataCode(String iataCode);
}

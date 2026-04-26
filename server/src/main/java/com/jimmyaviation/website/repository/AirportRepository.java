package com.jimmyaviation.website.repository;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.jimmyaviation.website.entity.Airport;

public interface AirportRepository extends JpaRepository<Airport, UUID> {
    Optional<Airport> findByIataCode(String iataCode);
}

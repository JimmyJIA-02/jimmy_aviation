package com.jimmyaviation.website.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.jimmyaviation.website.entity.Flight;

public interface FlightRepository extends JpaRepository<Flight, Integer> {
    
}

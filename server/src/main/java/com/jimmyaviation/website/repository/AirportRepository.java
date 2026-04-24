package com.jimmyaviation.website.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.jimmyaviation.website.entity.Airport;

public interface AirportRepository extends JpaRepository<Airport, Integer> {
    
}

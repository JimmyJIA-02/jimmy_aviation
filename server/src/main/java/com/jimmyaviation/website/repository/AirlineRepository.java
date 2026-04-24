package com.jimmyaviation.website.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.jimmyaviation.website.entity.Airline;

public interface AirlineRepository extends JpaRepository<Airline, Integer> {
    
}

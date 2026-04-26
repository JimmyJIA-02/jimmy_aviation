package com.jimmyaviation.website.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.jimmyaviation.website.entity.Airline;

public interface AirlineRepository extends JpaRepository<Airline, Integer> {
    Optional<Airline> findByIcaoCode(String icaoCode);
}

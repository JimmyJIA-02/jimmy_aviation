package com.jimmyaviation.website.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.jimmyaviation.website.entity.Aircraft;

public interface AircraftRepository extends JpaRepository<Aircraft, Integer> {
    
}

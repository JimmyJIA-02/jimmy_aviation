package com.jimmyaviation.website.repository;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.jimmyaviation.website.entity.Aircraft;

public interface AircraftRepository extends JpaRepository<Aircraft, UUID> {
    Optional<Aircraft> findByIcaoCode(String icaoCode);
}

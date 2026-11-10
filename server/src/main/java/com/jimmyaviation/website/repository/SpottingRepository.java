package com.jimmyaviation.website.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.jimmyaviation.website.entity.Spotting;
import java.time.LocalDate;


public interface SpottingRepository extends JpaRepository<Spotting, UUID> {
    List<Spotting> findByAirlineId(UUID airlineId);
    List<Spotting> findByAircraftId(UUID aircraftId);
    List<Spotting> findBySpotLocation(UUID AirportId);
    List<Spotting> findBySpotDate(LocalDate spotDate);

    @Modifying
    @Query("UPDATE Spotting s SET s.likes = s.likes + 1 WHERE s.id = :id")
    int incrementLikes(@Param("id") UUID id);
}

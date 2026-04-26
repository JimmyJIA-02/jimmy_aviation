package com.jimmyaviation.website.controller;

import com.jimmyaviation.website.entity.*;
import com.jimmyaviation.website.service.GalleryService;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class GalleryController {

    private final GalleryService galleryService;

    @GetMapping("/spotting")
    public ResponseEntity<List<Spotting>> getAllSpottings() {
        return ResponseEntity.ok(galleryService.getAllSpottings());
    }

    // Get a specific spotting by ID, maybe used for a detailed view page
    @GetMapping("/spotting/{id}")
    public ResponseEntity<Spotting> getSpotting(@PathVariable UUID id) {
        return galleryService.getSpottingById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // Filters
    // By airline
    @GetMapping("/spotting/filter/airline/{airlineId}")
    public ResponseEntity<List<Spotting>> getByAirline(@PathVariable UUID airlineId) {
        return ResponseEntity.ok(galleryService.getByAirline(airlineId));
    }

    // By aircraft
    @GetMapping("/spotting/filter/aircraft/{aircraftId}")
    public ResponseEntity<List<Spotting>> getByAircraft(@PathVariable UUID aircraftId) {
        return ResponseEntity.ok(galleryService.getByAircraft(aircraftId));
    }

    // By spot location
    @GetMapping("/spotting/filter/airport/{airportId}")
    public ResponseEntity<List<Spotting>> getByAirport(@PathVariable UUID airportId) {
        return ResponseEntity.ok(galleryService.getByAirport(airportId));
    }

    // by time (months, years)

    
    // Overview
    // get all airlines
    @GetMapping("/airline")
    public ResponseEntity<List<Airline>> getAllAirlines() {
        return ResponseEntity.ok(galleryService.getAllAirlines());
    }

    // get all aircraft
    @GetMapping("/aircraft")
    public ResponseEntity<List<Aircraft>> getAllAircraft() {
        return ResponseEntity.ok(galleryService.getAllAircraft());
    }

    // get all spot location
    @GetMapping("/airport")
    public ResponseEntity<List<Airport>> getAllAirports() {
        return ResponseEntity.ok(galleryService.getAllAirports());
    }
}
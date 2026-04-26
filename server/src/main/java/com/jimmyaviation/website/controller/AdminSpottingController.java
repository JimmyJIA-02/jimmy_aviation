package com.jimmyaviation.website.controller;

import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.jimmyaviation.website.entity.Spotting;
import com.jimmyaviation.website.service.AdminSpottingService;

import lombok.RequiredArgsConstructor;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

@RestController
@RequestMapping("/api/admin/spotting")
@RequiredArgsConstructor
public class AdminSpottingController {
    private final AdminSpottingService adminSpottingService;

    @GetMapping
    public ResponseEntity<List<Spotting>> getAllSpottings() {
        return ResponseEntity.ok(adminSpottingService.findAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Spotting> getSpottingById(@PathVariable UUID id) {
        try {
            return ResponseEntity.ok(adminSpottingService.findById(id));
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping
    public ResponseEntity<Spotting> createSpotting(@RequestBody Map<String, String> request) {
        Spotting spotting = adminSpottingService.createSpotting(
                request.get("registration"),
                request.get("photoUrl"),
                request.get("thumbnailUrl"),
                LocalDate.parse(request.get("spotDate")),
                request.get("notes"),
                request.get("aircraftIcao"),
                request.get("aircraftTypeName"),
                request.get("airlineIcao"),
                request.get("airlineName"),
                request.get("flightNumber"),
                request.get("departureCity"),
                request.get("arrivalCity"),
                request.get("spotLocationIata"),
                request.get("spotLocationName"),
                request.get("spotLocationCity"),
                request.get("spotLocationCountry"));
        return ResponseEntity.status(201).body(spotting);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> deleteSpotting(@PathVariable UUID id) {
        adminSpottingService.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Spotting deleted"));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<Spotting> patchSpotting(
            @PathVariable UUID id,
            @RequestBody Map<String, String> updates) {
        return ResponseEntity.ok(adminSpottingService.patchSpotting(id, updates));
    }
}

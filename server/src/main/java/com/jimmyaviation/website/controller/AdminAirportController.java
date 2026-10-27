package com.jimmyaviation.website.controller;

import com.jimmyaviation.website.dto.AirportView;
import com.jimmyaviation.website.service.AirportService;

import lombok.RequiredArgsConstructor;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/airports")
@RequiredArgsConstructor
public class AdminAirportController {

    private final AirportService airportService;

    @GetMapping
    public ResponseEntity<List<AirportView>> listAirports() {
        return ResponseEntity.ok(airportService.listAirports());
    }

    // name, city and country; the IATA code stays as it is
    @PatchMapping("/{id}")
    public ResponseEntity<AirportView> updateAirport(@PathVariable UUID id, @RequestBody Map<String, String> updates) {
        return ResponseEntity.ok(airportService.updateDetails(id, updates));
    }

    @PostMapping("/{id}/photo")
    public ResponseEntity<AirportView> uploadPhoto(@PathVariable UUID id, @RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(airportService.uploadPhoto(id, file));
    }

    @DeleteMapping("/{id}/photo")
    public ResponseEntity<AirportView> removePhoto(@PathVariable UUID id) {
        return ResponseEntity.ok(airportService.removePhoto(id));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleBadInput(IllegalArgumentException e) {
        return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
    }
}

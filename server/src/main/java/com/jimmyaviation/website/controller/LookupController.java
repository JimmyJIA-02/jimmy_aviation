package com.jimmyaviation.website.controller;

import com.jimmyaviation.website.dto.AirportInfo;
import com.jimmyaviation.website.repository.AirlineRepository;
import com.jimmyaviation.website.repository.FlightRepository;
import com.jimmyaviation.website.service.AirlineLogoService;
import com.jimmyaviation.website.service.AirportInfoService;

import lombok.RequiredArgsConstructor;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

// Public lookups for the gate display. Only codes already used by a spotting are resolved,
// so the external APIs can't be driven by arbitrary requests.
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class LookupController {

    private final AirportInfoService airportInfoService;
    private final AirlineLogoService airlineLogoService;
    private final FlightRepository flightRepository;
    private final AirlineRepository airlineRepository;

    @GetMapping("/airport-info/{iata}")
    public ResponseEntity<AirportInfo> getAirportInfo(@PathVariable String iata) {
        String code = iata.toUpperCase();
        if (!flightRepository.existsByDepartureAirportOrArrivalAirport(code, code)) {
            return ResponseEntity.notFound().build();
        }
        return airportInfoService.find(code)
                // the server already caches in memory; browsers re-ask so name changes show up immediately
                .map(info -> ResponseEntity.ok()
                        .header(HttpHeaders.CACHE_CONTROL, "no-cache")
                        .body(info))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/airline/{icao}/logo")
    public ResponseEntity<byte[]> getAirlineLogo(@PathVariable String icao) {
        String code = icao.toUpperCase();
        if (!airlineRepository.existsByIcaoCode(code)) {
            return ResponseEntity.notFound().build();
        }
        return airlineLogoService.getLogo(code)
                .map(bytes -> ResponseEntity.ok()
                        .contentType(MediaType.IMAGE_PNG)
                        .header(HttpHeaders.CACHE_CONTROL, "max-age=604800")
                        .body(bytes))
                .orElse(ResponseEntity.notFound().build());
    }
}

package com.jimmyaviation.website.service;

import com.jimmyaviation.website.entity.*;
import com.jimmyaviation.website.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AdminSpottingService {

    private final SpottingRepository spottingRepository;
    private final AircraftRepository aircraftRepository;
    private final AirlineRepository airlineRepository;
    private final AirportRepository airportRepository;
    private final FlightRepository flightRepository;

    private final PhotoService photoService;

    public Spotting createSpotting(
            String registration,
            String photoUrl,
            String thumbnailUrl,
            LocalDate spotDate,
            String notes,
            String aircraftIcao,
            String aircraftTypeName,
            String airlineIcao,
            String airlineName,
            String flightNumber,
            String departureCity,
            String arrivalCity,
            String spotLocationIata,
            String spotLocationName,
            String spotLocationCity,
            String spotLocationCountry) {
        Aircraft aircraft = findOrCreateAircraft(aircraftIcao, aircraftTypeName);
        Airline airline = findOrCreateAirline(airlineIcao, airlineName);
        Airport spotLocation = findOrCreateAirport(spotLocationIata, spotLocationName, spotLocationCity,
                spotLocationCountry);
        Flight flight = findOrCreateFlight(flightNumber, departureCity, arrivalCity);

        Spotting spotting = new Spotting();
        spotting.setRegistration(registration);
        spotting.setPhotoUrl(photoUrl);
        spotting.setThumbnailUrl(thumbnailUrl);
        spotting.setSpotDate(spotDate);
        spotting.setNotes(notes);
        spotting.setAircraft(aircraft);
        spotting.setAirline(airline);
        spotting.setFlight(flight);
        spotting.setSpotLocation(spotLocation);

        return spottingRepository.save(spotting);
    }

    public List<Spotting> findAll() {
        return spottingRepository.findAll();
    }

    public Spotting findById(Integer id) {
        return spottingRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Spotting not found"));
    }

    public void deleteById(Integer id) {
        // delete the photo from S3
        Spotting spotting = spottingRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Spotting not found"));
        String url = spotting.getPhotoUrl();
        photoService.deletePhoto(url);
        // delete the spotting record
        spottingRepository.deleteById(id);
    }

    private Aircraft findOrCreateAircraft(String icaoCode, String typeName) {
        return aircraftRepository.findByIcaoCode(icaoCode)
                .orElseGet(() -> {
                    Aircraft a = new Aircraft();
                    a.setIcaoCode(icaoCode);
                    a.setTypeName(typeName);
                    return aircraftRepository.save(a);
                });
    }

    private Airline findOrCreateAirline(String icaoCode, String airlineName) {
        return airlineRepository.findByIcaoCode(icaoCode)
                .orElseGet(() -> {
                    Airline a = new Airline();
                    a.setIcaoCode(icaoCode);
                    a.setAirlineName(airlineName);
                    return airlineRepository.save(a);
                });
    }

    private Airport findOrCreateAirport(String iataCode, String airportName, String city, String country) {
        return airportRepository.findByIataCode(iataCode)
                .orElseGet(() -> {
                    Airport a = new Airport();
                    a.setIataCode(iataCode);
                    a.setAirportName(airportName);
                    a.setCity(city);
                    a.setCountry(country);
                    return airportRepository.save(a);
                });
    }

    private Flight findOrCreateFlight(String flightNumber, String departure, String arrival) {
        return flightRepository.findByFlightNumber(flightNumber)
                .orElseGet(() -> {
                    Flight f = new Flight();
                    f.setFlightNumber(flightNumber);
                    f.setDepartureAirport(departure);
                    f.setArrivalAirport(arrival);
                    return flightRepository.save(f);
                });
    }

    public Spotting patchSpotting(Integer id, Map<String, String> updates) {
        Spotting spotting = spottingRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Spotting not found"));

        if (updates.containsKey("registration")) {
            spotting.setRegistration(updates.get("registration"));
        }
        if (updates.containsKey("photoUrl")) {
            spotting.setPhotoUrl(updates.get("photoUrl"));
        }
        if (updates.containsKey("thumbnailUrl")) {
            spotting.setThumbnailUrl(updates.get("thumbnailUrl"));
        }
        if (updates.containsKey("spotDate")) {
            spotting.setSpotDate(LocalDate.parse(updates.get("spotDate")));
        }
        if (updates.containsKey("notes")) {
            spotting.setNotes(updates.get("notes"));
        }
        if (updates.containsKey("airlineIcao")) {
            spotting.setAirline(findOrCreateAirline(
                    updates.get("airlineIcao"),
                    updates.get("airlineName")));
        }
        if (updates.containsKey("aircraftIcao")) {
            spotting.setAircraft(findOrCreateAircraft(
                    updates.get("aircraftIcao"),
                    updates.get("aircraftTypeName")));
        }
        if (updates.containsKey("spotLocationIata")) {
            spotting.setSpotLocation(findOrCreateAirport(
                    updates.get("spotLocationIata"),
                    updates.get("spotLocationName"),
                    updates.get("spotLocationCity"),
                    updates.get("spotLocationCountry")));
        }
        if (updates.containsKey("flightNumber")) {
            spotting.setFlight(findOrCreateFlight(
                    updates.get("flightNumber"),
                    updates.get("departureCity"),
                    updates.get("arrivalCity")));
        }

        return spottingRepository.save(spotting);
    }
}
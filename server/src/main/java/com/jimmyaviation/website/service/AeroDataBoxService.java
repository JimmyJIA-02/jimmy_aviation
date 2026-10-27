package com.jimmyaviation.website.service;

import com.jimmyaviation.website.dto.AeroDataBoxAirport;
import com.jimmyaviation.website.dto.AeroDataBoxResponse;

import tools.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;

@Service
public class AeroDataBoxService {

    // The plan allows about one request per second. Every call takes the next free slot, so requests
    // arriving together (e.g. the route map asking for many airports at once) queue instead of failing with 429.
    private static final long MIN_GAP_MS = 1100;
    private final Object rateLock = new Object();
    private long nextSlot = 0;

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final String apiKey;
    private final String baseUrl;

    public AeroDataBoxService(
            @Value("${adb.token}") String apiKey,
            @Value("${adb.host}") String baseUrl) {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
        this.objectMapper = new ObjectMapper();
    }

    // Sends at most one request per MIN_GAP_MS across all threads; a 429 waits for a new slot and retries
    private HttpResponse<String> send(HttpRequest request) throws Exception {
        HttpResponse<String> response = null;
        for (int attempt = 0; attempt < 4; attempt++) {
            long slot;
            synchronized (rateLock) {
                slot = Math.max(System.currentTimeMillis(), nextSlot);
                nextSlot = slot + MIN_GAP_MS;
            }
            long wait = slot - System.currentTimeMillis();
            if (wait > 0) Thread.sleep(wait);

            response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 429) break;
        }
        return response;
    }

    /**
     * Get arrivals and departures for an airport using relative time offsets.
     * 
     * @param icaoCode        Airport ICAO code (e.g. "YMML")
     * @param offsetMinutes   Minutes from now to start (negative = past). E.g. -120
     *                        = 2 hours ago.
     * @param durationMinutes Window size from offset. E.g. 720 = 12 hours.
     * @param withCargo       Whether to include cargo flights
     * @param withPrivate     Whether to include private flights
     */
    public AeroDataBoxResponse getPlanning(String icaoCode, int offsetMinutes, int durationMinutes, boolean withCargo,
            boolean withPrivate) {
        String url = String.format(
                "%s/flights/airports/iata/%s?offsetMinutes=%d&durationMinutes=%d&direction=Both&withCancelled=false&withCodeshared=false&withCargo=%s&withPrivate=%s&withLocation=false",
                baseUrl, icaoCode.toUpperCase(), offsetMinutes, durationMinutes, withCargo, withPrivate);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("x-rapidapi-key", apiKey)
                .header("x-rapidapi-host", baseUrl.replace("https://", ""))
                .timeout(Duration.ofSeconds(15))
                .GET()
                .build();

        try {
            HttpResponse<String> response = send(request);

            if (response.statusCode() != 200) {
                throw new RuntimeException(
                        "AeroDataBox API returned " + response.statusCode() + ": " + response.body());
            }

            return objectMapper.readValue(response.body(), AeroDataBoxResponse.class);
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("Failed to call AeroDataBox API", e);
        }
    }

    public Map<String, Object> lookupByRegistration(String registration) {
        String url = String.format("%s/aircrafts/reg/%s", baseUrl, registration.toUpperCase());

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("X-RapidAPI-Key", apiKey)
                .header("X-RapidAPI-Host", baseUrl.replace("https://", ""))
                .timeout(Duration.ofSeconds(15))
                .GET()
                .build();

        try {
            HttpResponse<String> response = send(request);

            if (response.statusCode() == 204 || response.statusCode() == 404) {
                return Map.of("found", false);
            }

            if (response.statusCode() != 200) {
                throw new RuntimeException("AeroDataBox API returned " + response.statusCode());
            }

            return objectMapper.readValue(response.body(), Map.class);
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("Failed to lookup registration", e);
        }
    }

    /**
     * Get an airport's names, municipality, country and location.
     *
     * @param iataCode Airport IATA code (e.g. "SIN")
     * @return the airport, or null if AeroDataBox doesn't know the code
     */
    public AeroDataBoxAirport lookupAirport(String iataCode) {
        String url = String.format("%s/airports/iata/%s", baseUrl, iataCode.toUpperCase());

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("x-rapidapi-key", apiKey)
                .header("x-rapidapi-host", baseUrl.replace("https://", ""))
                .timeout(Duration.ofSeconds(15))
                .GET()
                .build();

        try {
            HttpResponse<String> response = send(request);

            if (response.statusCode() == 204 || response.statusCode() == 404 || response.statusCode() == 400) {
                return null;
            }

            if (response.statusCode() != 200) {
                throw new RuntimeException("AeroDataBox API returned " + response.statusCode());
            }

            return objectMapper.readValue(response.body(), AeroDataBoxAirport.class);
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("Failed to lookup airport", e);
        }
    }
}
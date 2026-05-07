package com.jimmyaviation.website.service;

import com.jimmyaviation.website.dto.AeroDataBoxResponse;

import tools.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

@Service
public class AeroDataBoxService {

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

    /**
     * Get arrivals and departures for an airport using relative time offsets.
     * @param icaoCode Airport ICAO code (e.g. "YMML")
     * @param offsetMinutes Minutes from now to start (negative = past). E.g. -120 = 2 hours ago.
     * @param durationMinutes Window size from offset. E.g. 720 = 12 hours.
     * @param withCargo Whether to include cargo flights
     * @param withPrivate Whether to include private flights
     */
    public AeroDataBoxResponse getPlanning(String icaoCode, int offsetMinutes, int durationMinutes, boolean withCargo, boolean withPrivate) {
        String url = String.format(
                "%s/flights/airports/iata/%s?offsetMinutes=%d&durationMinutes=%d&direction=Both&withCancelled=false&withCodeshared=false&withCargo=%s&withPrivate=%s&withLocation=false",
                baseUrl, icaoCode.toUpperCase(), offsetMinutes, durationMinutes, withCargo, withPrivate
        );

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("x-rapidapi-key", apiKey)
                .header("x-rapidapi-host", baseUrl.replace("https://", ""))
                .timeout(Duration.ofSeconds(15))
                .GET()
                .build();

        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                throw new RuntimeException("AeroDataBox API returned " + response.statusCode() + ": " + response.body());
            }

            return objectMapper.readValue(response.body(), AeroDataBoxResponse.class);
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("Failed to call AeroDataBox API", e);
        }
    }
}
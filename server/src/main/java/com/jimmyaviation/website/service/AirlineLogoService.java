package com.jimmyaviation.website.service;

import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Serves airline tail logos by ICAO code, so visitors load them from this site instead of GitHub.
 * Logos are trademarks of their airlines, shown for identification only.
 */
@Service
public class AirlineLogoService {

    private static final List<String> SOURCES = List.of(
            "https://raw.githubusercontent.com/Jxck-S/airline-logos/main/flightaware_logos/%s.png",
            "https://raw.githubusercontent.com/Jxck-S/airline-logos/main/radarbox_logos/%s.png");

    // airlines that asked not to have their logo shown; they fall back to the generic plane
    private static final Set<String> BLOCKED = Set.of();

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    private final Map<String, Optional<byte[]>> cache = new ConcurrentHashMap<>();

    /**
     * @param icaoCode Airline ICAO code (e.g. "SIA")
     * @return PNG bytes, or empty if no source has this airline
     */
    public Optional<byte[]> getLogo(String icaoCode) {
        if (icaoCode == null || !icaoCode.matches("[A-Z0-9]{3}") || BLOCKED.contains(icaoCode)) {
            return Optional.empty();
        }
        Optional<byte[]> logo = cache.computeIfAbsent(icaoCode, this::download);
        return logo != null ? logo : Optional.empty();
    }

    // null (not cached) when a source couldn't be reached, so it's retried on the next request
    private Optional<byte[]> download(String icaoCode) {
        boolean failed = false;
        for (String source : SOURCES) {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(source.formatted(icaoCode)))
                    .timeout(Duration.ofSeconds(10))
                    .GET()
                    .build();
            try {
                HttpResponse<byte[]> response = httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());
                if (response.statusCode() == 200) {
                    return Optional.of(response.body());
                }
            } catch (Exception e) {
                failed = true;
            }
        }
        return failed ? null : Optional.empty();
    }
}

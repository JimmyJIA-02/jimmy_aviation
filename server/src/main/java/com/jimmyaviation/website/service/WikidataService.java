package com.jimmyaviation.website.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.jimmyaviation.website.dto.AirportInfo.LocalName;

import tools.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Looks up city names in local languages on Wikidata (data is CC0).
 */
@Service
public class WikidataService {

    private static final String ENDPOINT = "https://query.wikidata.org/sparql";
    private static final String USER_AGENT = "JimmyAviation/1.0 (personal plane-spotting gallery)";
    private static final int MAX_NAMES = 3;

    // airport (by ICAO, P239) -> city it serves (P931) -> country's official languages (P37) -> city labels
    private static final String QUERY = """
            SELECT ?en ?lang ?label WHERE {
              ?airport wdt:P239 "%s" ; wdt:P931 ?city ; wdt:P17 ?country .
              ?city rdfs:label ?en . FILTER(LANG(?en) = "en")
              ?country wdt:P37 ?langItem . ?langItem wdt:P424 ?lang .
              ?city rdfs:label ?label . FILTER(LANG(?label) = ?lang)
            }""";

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record SparqlResponse(Results results) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record Results(List<Map<String, Binding>> bindings) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record Binding(String value) {}

    /**
     * @param icaoCode    Airport ICAO code (e.g. "WSSS")
     * @param englishCity City the airport serves, as AeroDataBox names it (e.g. "Singapore").
     *                    Only a Wikidata city with this English name is used, so metro areas
     *                    or neighbouring cities don't sneak in.
     * @return up to 3 non-English names, empty if none or on any failure
     */
    public List<LocalName> localCityNames(String icaoCode, String englishCity) {
        if (icaoCode == null || !icaoCode.matches("[A-Z0-9]{4}") || englishCity == null) {
            return List.of();
        }

        String url = ENDPOINT + "?format=json&query="
                + URLEncoder.encode(QUERY.formatted(icaoCode), StandardCharsets.UTF_8);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Accept", "application/sparql-results+json")
                .header("User-Agent", USER_AGENT)
                .timeout(Duration.ofSeconds(15))
                .GET()
                .build();

        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                return List.of();
            }

            SparqlResponse parsed = objectMapper.readValue(response.body(), SparqlResponse.class);
            List<LocalName> names = new ArrayList<>();
            Set<String> seen = new HashSet<>(Set.of(englishCity.toLowerCase()));

            for (Map<String, Binding> row : parsed.results().bindings()) {
                String en = row.get("en").value();
                String lang = row.get("lang").value();
                String label = row.get("label").value();

                if (!en.equalsIgnoreCase(englishCity) || lang.equals("en")) continue;
                if (!seen.add(label.toLowerCase())) continue;

                names.add(new LocalName(lang, label));
                if (names.size() == MAX_NAMES) break;
            }
            return names;
        } catch (Exception e) {
            // translations are a nice-to-have; never fail the caller over them
            return List.of();
        }
    }
}

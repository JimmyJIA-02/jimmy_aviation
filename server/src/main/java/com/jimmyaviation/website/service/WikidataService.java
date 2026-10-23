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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Looks up airport names in local languages on Wikidata (data is CC0).
 */
@Service
public class WikidataService {

    private static final String ENDPOINT = "https://query.wikidata.org/sparql";
    private static final String USER_AGENT = "JimmyAviation/1.0 (personal plane-spotting gallery)";
    private static final int MAX_NAMES = 3;

    // airport (by ICAO, P239) -> country's official languages (P37) -> the airport's label in each,
    // plus the label of the city it serves (P931) as a fallback when the airport has none
    private static final String QUERY = """
            SELECT ?lang ?airportLabel ?cityEn ?cityLabel WHERE {
              ?airport wdt:P239 "%s" ; wdt:P17 ?country .
              ?country wdt:P37 ?langItem . ?langItem wdt:P424 ?lang .
              OPTIONAL { ?airport rdfs:label ?airportLabel . FILTER(LANG(?airportLabel) = ?lang) }
              OPTIONAL {
                ?airport wdt:P931 ?city .
                ?city rdfs:label ?cityEn . FILTER(LANG(?cityEn) = "en")
                ?city rdfs:label ?cityLabel . FILTER(LANG(?cityLabel) = ?lang)
              }
            }""";

    // "北京首都国际机场" -> "北京首都", "Flughafen Frankfurt Main" -> "Frankfurt Main", "مطار دبي الدولي" -> "دبي"
    private static final List<Pattern> AIRPORT_WORDS = List.of(
            Pattern.compile("^(lapangan terbang|aéroport|aeropuerto|aeroporto|flughafen|luchthaven|sân bay|bandar udara|havaalanı)\\s+"
                    + "((antarabangsa|internacional|internazionale|international|internasional|quốc tế)\\s+)?"
                    + "(de |di |du |d')?", Pattern.CASE_INSENSITIVE),
            Pattern.compile("^ท่าอากาศยาน(นานาชาติ)?"),
            Pattern.compile("^مطار\\s+"),
            Pattern.compile("\\s+الدولي$"),
            Pattern.compile("(国际机场|國際機場|國際機埸|国際空港|机场|機場|空港|국제공항|공항)$"),
            Pattern.compile("\\s*(பன்னாட்டு\\s+)?வானூர்தி நிலையம்$"),
            Pattern.compile("\\s+(international\\s+)?(airport|havalimanı)$", Pattern.CASE_INSENSITIVE));

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
     * @param icaoCode    Airport ICAO code (e.g. "ZBAA")
     * @param englishCity City the airport serves, as AeroDataBox names it (e.g. "Beijing").
     *                    A city label is only used as fallback when its English name matches,
     *                    so metro areas or neighbouring cities don't sneak in.
     * @return up to 3 non-English names, e.g. [("zh-cn", "北京首都")], empty if none or on any failure
     */
    public List<LocalName> localNames(String icaoCode, String englishCity) {
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

            // one name per language: the airport's own label wins over the city's
            Map<String, String> byLang = new LinkedHashMap<>();
            SparqlResponse parsed = objectMapper.readValue(response.body(), SparqlResponse.class);
            for (Map<String, Binding> row : parsed.results().bindings()) {
                String lang = row.get("lang").value();
                if (lang.equals("en")) continue;

                if (row.containsKey("airportLabel")) {
                    byLang.put(lang, stripAirportWords(row.get("airportLabel").value()));
                } else if (row.containsKey("cityLabel")
                        && row.get("cityEn").value().equalsIgnoreCase(englishCity)) {
                    byLang.putIfAbsent(lang, row.get("cityLabel").value());
                }
            }

            List<LocalName> names = new ArrayList<>();
            Set<String> seen = new HashSet<>(Set.of(englishCity.toLowerCase()));
            for (Map.Entry<String, String> entry : byLang.entrySet()) {
                if (!seen.add(entry.getValue().toLowerCase())) continue;
                names.add(new LocalName(entry.getKey(), entry.getValue()));
                if (names.size() == MAX_NAMES) break;
            }
            return names;
        } catch (Exception e) {
            // translations are a nice-to-have; never fail the caller over them
            return List.of();
        }
    }

    private static String stripAirportWords(String label) {
        String name = label.trim();
        for (Pattern p : AIRPORT_WORDS) {
            name = p.matcher(name).replaceAll("").trim();
        }
        return name.isEmpty() ? label : name;
    }
}

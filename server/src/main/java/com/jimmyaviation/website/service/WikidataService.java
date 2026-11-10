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
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
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

    // airport (by ICAO, P239) -> country's official languages (P37) -> the airport's labels in that
    // language and its variants (zh-cn -> zh, zh-hans, ...), plus the same for the city it serves (P931)
    // as a fallback when the airport has none.
    // ?civil and ?links pick the right item when several share the code (SGN's civil airport and the
    // old Tan Son Nhut Air Base are both VVTS)
    private static final String QUERY = """
            SELECT ?airport ?civil ?links ?lang ?kind ?labelLang ?label ?cityEn WHERE {
              ?airport wdt:P239 "%s" ; wdt:P17 ?country ; wikibase:sitelinks ?links .
              BIND(EXISTS { ?airport wdt:P31/wdt:P279* wd:Q1248784 } AS ?civil)
              ?country wdt:P37 ?langItem . ?langItem wdt:P424 ?lang .
              BIND(STRBEFORE(CONCAT(?lang, "-"), "-") AS ?base)
              {
                ?airport rdfs:label ?label . BIND("airport" AS ?kind)
              } UNION {
                ?airport wdt:P931 ?city .
                ?city rdfs:label ?label ; rdfs:label ?cityEn . FILTER(LANG(?cityEn) = "en")
                BIND("city" AS ?kind)
              }
              BIND(LANG(?label) AS ?labelLang)
              FILTER(?labelLang = ?base || STRSTARTS(?labelLang, CONCAT(?base, "-")))
            }""";

    // An airport's English name, for airports AeroDataBox has no names for (e.g. MGB).
    // The airport's own label is used rather than the city it serves: for MGB that lists a region
    private static final String ENGLISH_NAME_QUERY = """
            SELECT ?en WHERE {
              ?airport wdt:P239 "%s" ; wikibase:sitelinks ?links .
              BIND(EXISTS { ?airport wdt:P31/wdt:P279* wd:Q1248784 } AS ?civil)
              ?airport rdfs:label ?en . FILTER(LANG(?en) = "en")
            } ORDER BY DESC(?civil) DESC(?links) LIMIT 1""";

    // Wikidata often files a name under a sibling code rather than the country's official one,
    // e.g. Nanjing Lukou has "zh" and "zh-hans" but no "zh-cn". Plain "zh" may be in either script,
    // so the matching script variant is tried first.
    private static final Map<String, List<String>> LANG_FALLBACKS = Map.of(
            "zh-cn", List.of("zh-hans", "zh-sg", "zh-my", "zh"),
            "zh-sg", List.of("zh-hans", "zh-cn", "zh"),
            "zh-tw", List.of("zh-hant", "zh-hk", "zh"),
            "zh-hk", List.of("zh-hant", "zh-tw", "zh"),
            "zh-mo", List.of("zh-hk", "zh-hant", "zh"));

    // "北京首都国际机场" -> "北京首都", "Flughafen Frankfurt Main" -> "Frankfurt Main", "مطار دبي الدولي" -> "دبي"
    private static final List<Pattern> AIRPORT_WORDS = List.of(
            Pattern.compile("^(lapangan terbang|aéroport|aeropuerto|aeroporto|flughafen|luchthaven|sân bay|bandar udara|havaalanı)\\s+"
                    + "((antarabangsa|internacional|internazionale|international|internasional|quốc tế)\\s+)?"
                    + "(de |di |du |d')?", Pattern.CASE_INSENSITIVE),
            Pattern.compile("^ท่าอากาศยาน(นานาชาติ)?"),
            Pattern.compile("^boema-fofane( ba matjhaba)?( ba)?\\s+", Pattern.CASE_INSENSITIVE), // Sesotho
            Pattern.compile("\\s+(internasionale\\s+)?lughawe$", Pattern.CASE_INSENSITIVE), // Afrikaans
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
     * @param icaoCode Airport ICAO code (e.g. "YMTG")
     * @return the airport's English name without airport words ("Mount Gambier Airport" -> "Mount Gambier"),
     *         "" if Wikidata has none; Optional.empty() if Wikidata couldn't be reached, so callers can retry later
     */
    public Optional<String> englishName(String icaoCode) {
        if (icaoCode == null || !icaoCode.matches("[A-Z0-9]{4}")) {
            return Optional.of("");
        }
        try {
            HttpResponse<String> response = query(ENGLISH_NAME_QUERY.formatted(icaoCode));
            if (response.statusCode() != 200) {
                return Optional.empty();
            }
            SparqlResponse parsed = objectMapper.readValue(response.body(), SparqlResponse.class);
            return Optional.of(parsed.results().bindings().stream()
                    .findFirst()
                    .map(row -> stripAirportWords(row.get("en").value()))
                    .orElse(""));
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    /**
     * @param icaoCode    Airport ICAO code (e.g. "ZBAA")
     * @param englishCity City the airport serves, as AeroDataBox names it (e.g. "Beijing").
     *                    A city label is only used as fallback when its English name matches,
     *                    so metro areas or neighbouring cities don't sneak in.
     * @return up to 3 non-English names, e.g. [("zh-cn", "北京首都")], possibly none;
     *         Optional.empty() if Wikidata couldn't be reached (busy or timed out), so callers can retry later
     */
    public Optional<List<LocalName>> localNames(String icaoCode, String englishCity) {
        if (icaoCode == null || !icaoCode.matches("[A-Z0-9]{4}") || englishCity == null) {
            return Optional.of(List.of());
        }

        try {
            HttpResponse<String> response = query(QUERY.formatted(icaoCode));
            if (response.statusCode() != 200) {
                return Optional.empty();
            }

            SparqlResponse parsed = objectMapper.readValue(response.body(), SparqlResponse.class);
            List<Map<String, Binding>> rows = parsed.results().bindings();

            // several items can share an ICAO code: prefer one typed as an airport, then the best known
            Comparator<Map<String, Binding>> rank = Comparator
                    .comparing((Map<String, Binding> row) -> row.get("civil").value().equals("true"))
                    .thenComparing(row -> Integer.parseInt(row.get("links").value()));
            String item = rows.stream().max(rank).map(row -> row.get("airport").value()).orElse(null);

            // official language -> label language -> label, separately for the airport and its city
            Map<String, Map<String, String>> airportLabels = new LinkedHashMap<>();
            Map<String, Map<String, String>> cityLabels = new LinkedHashMap<>();
            for (Map<String, Binding> row : rows) {
                if (!row.get("airport").value().equals(item)) continue;

                String lang = row.get("lang").value();
                if (lang.equals("en")) continue;

                boolean isAirport = row.get("kind").value().equals("airport");
                if (!isAirport && !row.get("cityEn").value().equalsIgnoreCase(englishCity)) continue;

                airportLabels.computeIfAbsent(lang, k -> new LinkedHashMap<>());
                (isAirport ? airportLabels : cityLabels)
                        .computeIfAbsent(lang, k -> new LinkedHashMap<>())
                        .putIfAbsent(row.get("labelLang").value(), row.get("label").value());
            }

            // one name per official language: the airport's own label wins over the city's
            List<LocalName> names = new ArrayList<>();
            Set<String> seen = new HashSet<>(Set.of(englishCity.toLowerCase()));
            for (String lang : airportLabels.keySet()) {
                String airport = pick(lang, airportLabels.get(lang));
                String name = airport != null
                        ? stripAirportWords(airport)
                        : pick(lang, cityLabels.getOrDefault(lang, Map.of()));
                if (name == null || !seen.add(name.toLowerCase())) continue;

                names.add(new LocalName(lang, name));
                if (names.size() == MAX_NAMES) break;
            }
            return Optional.of(names);
        } catch (Exception e) {
            // translations are a nice-to-have; never fail the caller over them
            return Optional.empty();
        }
    }

    private HttpResponse<String> query(String sparql) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(ENDPOINT + "?format=json&query=" + URLEncoder.encode(sparql, StandardCharsets.UTF_8)))
                .header("Accept", "application/sparql-results+json")
                .header("User-Agent", USER_AGENT)
                .timeout(Duration.ofSeconds(15))
                .GET()
                .build();
        return httpClient.send(request, HttpResponse.BodyHandlers.ofString());
    }

    // exact language first, then its variants, then the bare language ("pt-br" -> "pt")
    private static String pick(String lang, Map<String, String> labels) {
        List<String> order = new ArrayList<>();
        order.add(lang);
        order.addAll(LANG_FALLBACKS.getOrDefault(lang, List.of()));
        order.add(lang.split("-")[0]);
        for (String candidate : order) {
            if (labels.containsKey(candidate)) return labels.get(candidate);
        }
        return null;
    }

    private static String stripAirportWords(String label) {
        String name = label.trim();
        for (Pattern p : AIRPORT_WORDS) {
            name = p.matcher(name).replaceAll("").trim();
        }
        return name.isEmpty() ? label : name;
    }
}

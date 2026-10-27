package com.jimmyaviation.website.service;

import com.jimmyaviation.website.dto.AirportInfo;
import com.jimmyaviation.website.dto.AirportView;
import com.jimmyaviation.website.dto.SpottingLocation;
import com.jimmyaviation.website.entity.Airport;
import com.jimmyaviation.website.entity.Spotting;
import com.jimmyaviation.website.repository.AirportRepository;
import com.jimmyaviation.website.repository.SpottingRepository;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * Airports spotted from (the airports table): details, photos and the Spotting Locations data.
 * An airport's photo lives in S3 under a fixed key per IATA code (airport-MEL), so no database column is needed;
 * uploading replaces the previous photo.
 */
@Service
@RequiredArgsConstructor
public class AirportService {

    private final AirportRepository airportRepository;
    private final SpottingRepository spottingRepository;
    private final PhotoService photoService;
    private final AirportInfoService airportInfoService;

    // IATA -> photo version (S3 ETag), "" when there is no photo. Checked once per airport, kept up to date on upload/remove.
    private final Map<String, String> photoVersions = new ConcurrentHashMap<>();

    private static String photoKey(String iata) {
        return "airport-" + iata.toUpperCase();
    }

    private static boolean isValidIata(String iata) {
        return iata != null && iata.toUpperCase().matches("[A-Z0-9]{3}");
    }

    /** @return the photo's URL, versioned so browsers pick up a replaced photo, or null if there's none */
    public String photoUrl(String iata) {
        if (!isValidIata(iata)) return null;
        String code = iata.toUpperCase();
        String version = photoVersions.get(code);
        if (version == null) {
            try {
                version = photoService.photoVersion(photoKey(code)).orElse("");
                photoVersions.put(code, version);
            } catch (RuntimeException e) {
                return null; // S3 unreachable; not cached, so it's checked again next time
            }
        }
        return version.isEmpty() ? null : "/api/photo/" + photoKey(code) + "?v=" + version;
    }

    public List<AirportView> listAirports() {
        Map<UUID, Long> counts = spottingRepository.findAll().stream()
                .filter(s -> s.getSpotLocation() != null)
                .collect(Collectors.groupingBy(s -> s.getSpotLocation().getId(), Collectors.counting()));
        return airportRepository.findAll().stream()
                .sorted(Comparator.comparing((Airport a) -> counts.getOrDefault(a.getId(), 0L)).reversed()
                        .thenComparing(Airport::getIataCode, Comparator.nullsLast(Comparator.naturalOrder())))
                .map(a -> toView(a, counts.getOrDefault(a.getId(), 0L)))
                .toList();
    }

    public AirportView updateDetails(UUID id, Map<String, String> updates) {
        Airport airport = find(id);
        if (updates.containsKey("airportName")) airport.setAirportName(required(updates, "airportName"));
        if (updates.containsKey("city")) airport.setCity(required(updates, "city"));
        if (updates.containsKey("country")) airport.setCountry(required(updates, "country"));
        airportRepository.save(airport);
        return toView(airport, countSpottings(airport));
    }

    public AirportView uploadPhoto(UUID id, MultipartFile file) {
        Airport airport = find(id);
        if (!isValidIata(airport.getIataCode())) {
            throw new IllegalArgumentException("This airport has no valid IATA code, so its photo can't be stored");
        }
        if (file == null || file.isEmpty() || file.getContentType() == null || !file.getContentType().startsWith("image/")) {
            throw new IllegalArgumentException("Please choose an image file");
        }
        String key = photoKey(airport.getIataCode());
        photoService.putPhoto(key, file);
        photoVersions.remove(airport.getIataCode().toUpperCase()); // re-read the new version
        return toView(airport, countSpottings(airport));
    }

    public AirportView removePhoto(UUID id) {
        Airport airport = find(id);
        if (isValidIata(airport.getIataCode())) {
            photoService.deletePhoto(photoKey(airport.getIataCode()));
            photoVersions.put(airport.getIataCode().toUpperCase(), "");
        }
        return toView(airport, countSpottings(airport));
    }

    /** Every airport with at least one spotting, with its photo count, visit dates, photo and where it is */
    public List<SpottingLocation> spottingLocations() {
        Map<Airport, List<Spotting>> byAirport = spottingRepository.findAll().stream()
                .filter(s -> s.getSpotLocation() != null)
                .collect(Collectors.groupingBy(Spotting::getSpotLocation));

        return byAirport.entrySet().stream()
                .map(entry -> {
                    Airport a = entry.getKey();
                    List<LocalDate> dates = entry.getValue().stream()
                            .map(Spotting::getSpotDate).filter(Objects::nonNull).sorted().toList();
                    Optional<AirportInfo> info = lookup(a.getIataCode());
                    return new SpottingLocation(
                            a.getIataCode(),
                            a.getAirportName(),
                            a.getCity(),
                            a.getCountry(),
                            info.map(AirportInfo::countryCode).orElse(null),
                            info.map(AirportInfo::country).orElse(null),
                            info.map(AirportInfo::lat).orElse(null),
                            info.map(AirportInfo::lon).orElse(null),
                            entry.getValue().size(),
                            dates.isEmpty() ? null : dates.get(0),
                            dates.isEmpty() ? null : dates.get(dates.size() - 1),
                            photoUrl(a.getIataCode()));
                })
                .sorted(Comparator.comparingLong(SpottingLocation::count).reversed())
                .toList();
    }

    // flag, map and satellite need the country code and coordinates; a failed lookup just leaves them out
    private Optional<AirportInfo> lookup(String iata) {
        try {
            return airportInfoService.find(iata == null ? null : iata.toUpperCase(), false);
        } catch (RuntimeException e) {
            return Optional.empty();
        }
    }

    private AirportView toView(Airport a, long spottings) {
        return new AirportView(a.getId(), a.getIataCode(), a.getAirportName(), a.getCity(), a.getCountry(),
                spottings, photoUrl(a.getIataCode()));
    }

    private long countSpottings(Airport airport) {
        return spottingRepository.findAll().stream()
                .filter(s -> s.getSpotLocation() != null && s.getSpotLocation().getId().equals(airport.getId()))
                .count();
    }

    private Airport find(UUID id) {
        return airportRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Airport not found"));
    }

    private static String required(Map<String, String> updates, String field) {
        String value = updates.get(field);
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(field + " can't be empty");
        }
        return value.trim();
    }
}

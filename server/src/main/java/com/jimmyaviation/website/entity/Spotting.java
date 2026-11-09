package com.jimmyaviation.website.entity;

import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

import org.hibernate.annotations.Fetch;
import org.hibernate.annotations.FetchMode;

import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(name = "spottings")
public class Spotting {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String registration;

    @Column(name = "photo_url", nullable = false)
    private String photoUrl;

    @Column(name = "thumbnail_url")
    private String thumbnailUrl;

    @Column(name = "spot_date", nullable = false)
    private LocalDate spotDate;

    // @Column(nullable = false)
    private String notes;

    @Column(nullable = false)
    private Integer likes = 0;

    @ManyToOne
    @JoinColumn(name = "flight_id", nullable = false)
    private Flight flight;

    @ManyToOne
    @JoinColumn(name = "airline_id", nullable = false)
    private Airline airline;

    @ManyToOne
    @JoinColumn(name = "aircraft_id", nullable = false)
    private Aircraft aircraft;

    @ManyToOne
    @JoinColumn(name = "spot_location", nullable = false)
    private Airport spotLocation;

    // categories ticked on the form, e.g. "cargo", "special-scheme" (see SpottingTags);
    // loaded for all spottings in one extra query rather than one per spotting
    @ElementCollection(fetch = FetchType.EAGER)
    @Fetch(FetchMode.SUBSELECT)
    @CollectionTable(name = "spotting_tags", joinColumns = @JoinColumn(name = "spotting_id"))
    @Column(name = "tag", nullable = false, length = 32)
    private Set<String> tags = new HashSet<>();
}

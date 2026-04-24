package com.jimmyaviation.website.entity;

import java.time.LocalDate;

import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(name = "spottings")
public class Spotting {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

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
}

package com.jimmyaviation.website.entity;

import java.util.UUID;

import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(name = "airlines")
public class Airline {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "icao_code", nullable = false)
    private String icaoCode; 

    @Column(name = "airline_name", nullable = false)
    private String airlineName;

    // where the airline is from, ISO 3166-1 alpha-2 (e.g. "AU", "HK"); set on the spotting form
    @Column(name = "country_code", length = 2)
    private String countryCode;
}

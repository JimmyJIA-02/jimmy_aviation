package com.jimmyaviation.website.entity;

import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(name = "airlines")
public class Airline {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "icao_code", nullable = false)
    private String icaoCode; 

    @Column(name = "airline_name", nullable = false)
    private String airlineName;
}

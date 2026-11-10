package com.jimmyaviation.website.entity;

import java.util.UUID;

import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(name = "flights")
public class Flight {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "flight_number", nullable = false)
    private String flightNumber;

    @Column(name = "departure_airport", nullable = false)
    private String departureAirport;

    @Column(name = "arrival_airport", nullable = false)
    private String arrivalAirport;
}

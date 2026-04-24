package com.jimmyaviation.website.entity;

import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(name = "aircrafts")
public class Aircraft {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "icao_code", nullable = false)
    private String icaoCode;

    @Column(name = "type_name", nullable = false)
    private String typeName;
}

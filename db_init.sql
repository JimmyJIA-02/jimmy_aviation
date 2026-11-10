CREATE TABLE IF NOT EXISTS aircrafts (
    id UUID PRIMARY KEY,
    icao_code VARCHAR(255) NOT NULL,
    type_name VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS airlines (
    id UUID PRIMARY KEY,
    icao_code VARCHAR(255) NOT NULL,
    airline_name VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS airports (
    id UUID PRIMARY KEY,
    iata_code VARCHAR(255) NOT NULL,
    airport_name VARCHAR(255) NOT NULL,
    city VARCHAR(255) NOT NULL,
    country VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS flights (
    id UUID PRIMARY KEY,
    flight_number VARCHAR(255) NOT NULL,
    departure_airport VARCHAR(255) NOT NULL,
    arrival_airport VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_user (
    id UUID PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'ADMIN',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS spottings (
    id UUID PRIMARY KEY,
    registration VARCHAR(20) NOT NULL,
    photo_url VARCHAR(500) NOT NULL,
    thumbnail_url VARCHAR(500),
    spot_date DATE NOT NULL,
    notes TEXT,
    airline_id UUID REFERENCES airlines(id),
    aircraft_id UUID REFERENCES aircrafts(id),
    flight_id UUID REFERENCES flights(id),
    spot_location UUID REFERENCES airports(id),
    likes INTEGER NOT NULL DEFAULT 0
);
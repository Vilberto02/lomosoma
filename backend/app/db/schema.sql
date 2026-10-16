CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS lomas (
    id VARCHAR(16) PRIMARY KEY,
    nombre VARCHAR(180) NOT NULL,
    distrito VARCHAR(120) NOT NULL,
    tipo VARCHAR(80) NOT NULL,
    dificultad VARCHAR(40) NOT NULL,
    ubicacion GEOGRAPHY(POINT, 4326) NOT NULL,
    saturacion_base NUMERIC(4, 2) NOT NULL DEFAULT 0.20,
    seguridad_base NUMERIC(4, 2) NOT NULL DEFAULT 7.00,
    clima_verdor_base NUMERIC(4, 2) NOT NULL DEFAULT 8.00,
    accesibilidad_base NUMERIC(4, 2) NOT NULL DEFAULT 7.00,
    costo_estimado NUMERIC(8, 2) NOT NULL DEFAULT 15.00,
    tiempo_estimado_horas NUMERIC(5, 2) NOT NULL DEFAULT 4.00,
    distancia_centro_min INTEGER NOT NULL DEFAULT 60,
    transporte_principal TEXT NOT NULL,
    descripcion TEXT NOT NULL,
    temporada_optima VARCHAR(80) NOT NULL,
    es_loma_natural BOOLEAN NOT NULL DEFAULT TRUE,
    pro_demo_gratis BOOLEAN NOT NULL DEFAULT FALSE,
    altitud_max_msnm INTEGER,
    desnivel_positivo_m INTEGER,
    distancia_sendero_km NUMERIC(5, 2),
    pendiente_max_pct INTEGER,
    composicion_terreno JSONB,
    garita_control JSONB,
    tarifario_oficial JSONB,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS senderos_lomas (
    loma_id VARCHAR(16) PRIMARY KEY REFERENCES lomas(id) ON DELETE CASCADE,
    nombre_circuito VARCHAR(200) NOT NULL,
    distancia_km NUMERIC(5, 2) NOT NULL,
    desnivel_positivo_m INTEGER NOT NULL,
    altitud_min_msnm INTEGER NOT NULL,
    altitud_max_msnm INTEGER NOT NULL,
    trazado_3d GEOGRAPHY(LINESTRINGZ, 4326) NOT NULL,
    waypoints JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS reportes_ciudadanos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loma_id VARCHAR(16) NOT NULL REFERENCES lomas(id) ON DELETE CASCADE,
    autor VARCHAR(120) NOT NULL DEFAULT 'Excursionista',
    estado_barro VARCHAR(80) NOT NULL,
    flor_amancaes_vista BOOLEAN NOT NULL DEFAULT FALSE,
    colchon_nubes_visto BOOLEAN NOT NULL DEFAULT FALSE,
    comentario TEXT NOT NULL,
    fecha_iso TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS licencias_pago_unico (
    orden_id VARCHAR(64) PRIMARY KEY,
    email_cliente VARCHAR(180) NOT NULL,
    plan_id VARCHAR(40) NOT NULL,
    loma_id VARCHAR(16),
    acceso_total_lima BOOLEAN NOT NULL DEFAULT FALSE,
    monto_pagado_pen NUMERIC(8, 2) NOT NULL,
    metodo_pago VARCHAR(40) NOT NULL,
    token_licencia VARCHAR(128) NOT NULL UNIQUE,
    emitido_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sellos_cumbre_offline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loma_id VARCHAR(16) NOT NULL REFERENCES lomas(id) ON DELETE CASCADE,
    lat_verificada DOUBLE PRECISION NOT NULL,
    lon_verificada DOUBLE PRECISION NOT NULL,
    distancia_cumbre_m NUMERIC(6, 2) NOT NULL,
    hash_firma_sha256 VARCHAR(64) NOT NULL UNIQUE,
    capturado_en TIMESTAMPTZ NOT NULL,
    sincronizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

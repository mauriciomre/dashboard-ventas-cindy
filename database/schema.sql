-- ============================================================
-- Dashboard Ventas — Cindy Mayorista
-- Schema de base de datos
-- ============================================================

CREATE DATABASE IF NOT EXISTS cindy_dashboard CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE cindy_dashboard;

-- ------------------------------------------------------------
-- Tabla: ventas_mensuales
-- Fuente: array RAW del dashboard (histórico desde 2016)
-- locales_json almacena el desglose por local como JSON
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ventas_mensuales (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  anio        SMALLINT UNSIGNED NOT NULL,
  mes         TINYINT UNSIGNED  NOT NULL,
  total       DECIMAL(18,2)     NOT NULL DEFAULT 0,
  locales_json TEXT             NOT NULL COMMENT 'JSON: {"Peatonal": 123, "Deposito": 456, ...}',
  UNIQUE KEY uq_anio_mes (anio, mes)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- Tabla: detalle_ventas
-- Fuente: array DET del dashboard (ERP desde 2023)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS detalle_ventas (
  id       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  anio     SMALLINT UNSIGNED NOT NULL,
  mes      TINYINT UNSIGNED  NOT NULL,
  local    VARCHAR(50)       NOT NULL,
  rubro    VARCHAR(80)       NOT NULL,
  valor    DECIMAL(18,2)     NOT NULL DEFAULT 0,
  unidades INT               NOT NULL DEFAULT 0,
  INDEX idx_anio_mes  (anio, mes),
  INDEX idx_local     (local),
  INDEX idx_rubro     (rubro)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

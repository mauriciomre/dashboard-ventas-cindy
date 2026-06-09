-- ============================================================
-- Dashboard Ventas — Cindy Mayorista
-- Schema de base de datos
-- ============================================================

-- La BD ya existe en Donweb, no es necesario crearla.
-- Asegurate de tener seleccionada td000310_dashb_1 en phpMyAdmin antes de importar.

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
  INDEX idx_anio_mes       (anio, mes),
  INDEX idx_anio_mes_local (anio, mes, local),
  INDEX idx_local          (local),
  INDEX idx_rubro          (rubro)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- Tabla: import_log
-- Historial de importaciones desde el panel admin
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS import_log (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  fecha               DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  usuario             VARCHAR(50)   NOT NULL DEFAULT 'admin',
  registros           INT           NOT NULL DEFAULT 0,
  meses_actualizados  INT           NOT NULL DEFAULT 0,
  meses_texto         VARCHAR(255)  NOT NULL DEFAULT '',
  INDEX idx_fecha (fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

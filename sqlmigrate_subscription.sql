-- ============================================================
-- SUSCRIPCIONES SaaS — Restaurant API
-- ============================================================
-- ANTES de correr: haz un respaldo de la base en Neon.
-- Si ya corriste este script antes, es idempotente (re-ejecutable).
-- Los restaurantes existentes quedan en trial/trialing SIN trial_ends_at
-- (el gate los trata como activos hasta que actives el trial o paguen).
-- ============================================================

BEGIN;

-- 1. Columnas de suscripción en restaurants
ALTER TABLE restaurants
    ADD COLUMN IF NOT EXISTS plan VARCHAR(20) DEFAULT 'trial' NOT NULL;
ALTER TABLE restaurants
    ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(20) DEFAULT 'trialing' NOT NULL;
ALTER TABLE restaurants
    ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP;
ALTER TABLE restaurants
    ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP;
ALTER TABLE restaurants
    ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMP;

-- 2. Tabla de pagos de suscripción (idempotente por provider_payment_id)
CREATE TABLE IF NOT EXISTS subscription_payments (
    id SERIAL PRIMARY KEY,
    restaurant_id INT REFERENCES restaurants(id),
    provider VARCHAR(20) NOT NULL,
    provider_payment_id VARCHAR(120) UNIQUE NOT NULL,
    plan VARCHAR(20) NOT NULL,
    cycle VARCHAR(20) NOT NULL,
    amount_cents INT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_subscription_payments_restaurant_id
    ON subscription_payments (restaurant_id);
CREATE UNIQUE INDEX IF NOT EXISTS ix_subscription_payments_provider_payment_id
    ON subscription_payments (provider_payment_id);

COMMIT;

-- ============================================================
-- MIGRACIÓN A MULTI-TENANT (SaaS) — Restaurant API v2.0
-- ============================================================
-- ANTES de correr: haz un respaldo de la base en Neon.
-- Después de correr: redespliega el backend en Render.
-- Si ya corriste este script antes, es idempotente (re-ejecutable).
-- ============================================================

BEGIN;

-- 1. Tabla de restaurantes
CREATE TABLE IF NOT EXISTS restaurants (
    id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    slug VARCHAR(120) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Insertar restaurante por defecto (id=1) para datos existentes
INSERT INTO restaurants (id, name, slug, is_active)
VALUES (1, 'Restaurante Principal', 'principal', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Ajustar la secuencia por si se insertó con id manual
SELECT setval(
    pg_get_serial_sequence('restaurants', 'id'),
    GREATEST((SELECT MAX(id) FROM restaurants), 1),
    TRUE
);

-- 3. Agregar columnas restaurant_id (nullable primero)
ALTER TABLE users            ADD COLUMN IF NOT EXISTS restaurant_id INT REFERENCES restaurants(id);
ALTER TABLE tables           ADD COLUMN IF NOT EXISTS restaurant_id INT REFERENCES restaurants(id);
ALTER TABLE categories       ADD COLUMN IF NOT EXISTS restaurant_id INT REFERENCES restaurants(id);
ALTER TABLE products         ADD COLUMN IF NOT EXISTS restaurant_id INT REFERENCES restaurants(id);
ALTER TABLE orders           ADD COLUMN IF NOT EXISTS restaurant_id INT REFERENCES restaurants(id);
ALTER TABLE order_status_history ADD COLUMN IF NOT EXISTS restaurant_id INT REFERENCES restaurants(id);
ALTER TABLE chat_sessions    ADD COLUMN IF NOT EXISTS restaurant_id INT REFERENCES restaurants(id);
ALTER TABLE loyalty_points   ADD COLUMN IF NOT EXISTS restaurant_id INT REFERENCES restaurants(id);

-- 4. Asignar TODOS los registros existentes al restaurante 1
UPDATE users               SET restaurant_id = 1 WHERE restaurant_id IS NULL;
UPDATE tables              SET restaurant_id = 1 WHERE restaurant_id IS NULL;
UPDATE categories          SET restaurant_id = 1 WHERE restaurant_id IS NULL;
UPDATE products            SET restaurant_id = 1 WHERE restaurant_id IS NULL;
UPDATE orders              SET restaurant_id = 1 WHERE restaurant_id IS NULL;
UPDATE order_status_history SET restaurant_id = 1 WHERE restaurant_id IS NULL;
UPDATE chat_sessions       SET restaurant_id = 1 WHERE restaurant_id IS NULL;
UPDATE loyalty_points      SET restaurant_id = 1 WHERE restaurant_id IS NULL;

-- 5. Hacer NOT NULL (excepto users, para permitir superadmin sin restaurante)
ALTER TABLE tables              ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE categories          ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE products            ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE orders              ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE order_status_history ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE chat_sessions       ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE loyalty_points      ALTER COLUMN restaurant_id SET NOT NULL;

-- 6. Reemplazar constraints únicas para multi-tenant
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tables_number_key'
    ) THEN
        ALTER TABLE tables DROP CONSTRAINT tables_number_key;
    END IF;
EXCEPTION WHEN undefined_object THEN
    NULL;
END $$;

ALTER TABLE tables DROP CONSTRAINT IF EXISTS uq_table_restaurant_number;
ALTER TABLE tables ADD CONSTRAINT uq_table_restaurant_number UNIQUE (restaurant_id, number);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'loyalty_points_user_id_key'
    ) THEN
        ALTER TABLE loyalty_points DROP CONSTRAINT loyalty_points_user_id_key;
    END IF;
EXCEPTION WHEN undefined_object THEN
    NULL;
END $$;

ALTER TABLE loyalty_points DROP CONSTRAINT IF EXISTS uq_loyalty_restaurant_user;
ALTER TABLE loyalty_points ADD CONSTRAINT uq_loyalty_restaurant_user UNIQUE (restaurant_id, user_id);

-- 7. Agregar valor 'superadmin' al enum nativo de Postgres (si existe)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'userrole') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum e
            JOIN pg_type t ON e.enumtypid = t.oid
            WHERE t.typname = 'userrole' AND e.enumlabel = 'superadmin'
        ) THEN
            ALTER TYPE userrole ADD VALUE 'superadmin';
        END IF;
    END IF;
END $$;

-- 8. Índices para mejorar queries multi-tenant
CREATE INDEX IF NOT EXISTS idx_users_restaurant           ON users (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_tables_restaurant          ON tables (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_categories_restaurant      ON categories (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_products_restaurant        ON products (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant          ON orders (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_restaurant   ON chat_sessions (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_points_restaurant  ON loyalty_points (restaurant_id);

COMMIT;

-- ============================================================
-- VERIFICACIÓN (ejecutar aparte):
-- ============================================================
-- SELECT count(*) FROM users WHERE restaurant_id IS NULL;          -- debe ser 0
-- SELECT count(*) FROM tables WHERE restaurant_id IS NULL;         -- debe ser 0
-- SELECT count(*) FROM restaurants;                                -- debe ser >= 1
-- SELECT enumlabel FROM pg_enum e JOIN pg_type t ON e.enumtypid=t.oid WHERE t.typname='userrole';
-- ============================================================

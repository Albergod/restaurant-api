-- ============================================================
-- ÍNDICES DE RENDIMIENTO — Restaurant API
-- ============================================================
-- Idempotente (re-ejecutable). Cubre los filtros calientes del polling:
-- pedidos por restaurante/estado/fecha y mensajes por sesión.
-- ============================================================

BEGIN;

CREATE INDEX IF NOT EXISTS ix_orders_restaurant_status_created
    ON orders (restaurant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_orders_table
    ON orders (table_id);

CREATE INDEX IF NOT EXISTS ix_order_items_order
    ON order_items (order_id);

CREATE INDEX IF NOT EXISTS ix_products_restaurant_category
    ON products (restaurant_id, category_id);

CREATE INDEX IF NOT EXISTS ix_chat_messages_session
    ON chat_messages (session_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS ix_chat_messages_unread
    ON chat_messages (session_id, sender, is_read);

CREATE INDEX IF NOT EXISTS ix_chat_sessions_restaurant_open
    ON chat_sessions (restaurant_id, is_open);

CREATE INDEX IF NOT EXISTS ix_order_history_order
    ON order_status_history (order_id);

COMMIT;

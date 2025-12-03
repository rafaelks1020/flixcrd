-- Script para marcar a migration inicial como aplicada (baselining)
-- Execute isso no DBeaver quando o banco estiver online

-- Criar tabela de migrations se não existir
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    id VARCHAR(36) PRIMARY KEY,
    checksum VARCHAR(64) NOT NULL,
    finished_at TIMESTAMPTZ,
    migration_name VARCHAR(255) NOT NULL,
    logs TEXT,
    rolled_back_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    applied_steps_count INTEGER NOT NULL DEFAULT 0
);

-- Marcar a migration inicial como aplicada
INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, applied_steps_count)
VALUES (
    gen_random_uuid()::text,
    '0',  -- checksum placeholder
    now(),
    '20251203164018_init',
    NULL,
    1
)
ON CONFLICT DO NOTHING;

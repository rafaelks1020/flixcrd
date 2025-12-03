-- RESET TOTAL DO SCHEMA (public e shadow)
-- CUIDADO: isso apaga TODAS as tabelas, índices e dados desses schemas.

DROP SCHEMA IF EXISTS public CASCADE;
DROP SCHEMA IF EXISTS shadow CASCADE;

CREATE SCHEMA public;
CREATE SCHEMA shadow;

GRANT ALL PRIVILEGES ON SCHEMA public TO crdflix_user;
GRANT ALL PRIVILEGES ON SCHEMA shadow TO crdflix_user;
GRANT USAGE ON SCHEMA public TO public;
GRANT USAGE ON SCHEMA shadow TO public;

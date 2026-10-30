-- Run through psql as school_migrator after migrations. Provide app_password via secure stdin/psql variable, not shell arguments.
\set ON_ERROR_STOP on
CREATE ROLE school_app LOGIN PASSWORD :'app_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
GRANT CONNECT ON DATABASE school TO school_app;
GRANT USAGE ON SCHEMA public TO school_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO school_app;
REVOKE UPDATE, DELETE, TRUNCATE ON audit_events FROM school_app;
REVOKE ALL ON schema_migrations FROM school_app;
GRANT SELECT ON schema_migrations TO school_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE school_migrator IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO school_app;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON platform_admins FROM school_app;
REVOKE UPDATE, DELETE, TRUNCATE ON platform_events FROM school_app;

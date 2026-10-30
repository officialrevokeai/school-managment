-- Operator-only hardening of the private server schema.
REVOKE ALL ON SCHEMA school_app FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA school_app FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA school_app FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA school_app FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA school_app REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA school_app REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA school_app REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA school_app TO school_app;
DO $secure$ DECLARE t record; f record; BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='school_app' LOOP
  EXECUTE format('ALTER TABLE school_app.%I ENABLE ROW LEVEL SECURITY',t.tablename);
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='school_app' AND tablename=t.tablename AND policyname='school_backend') THEN
   EXECUTE format('CREATE POLICY school_backend ON school_app.%I TO school_app USING (true) WITH CHECK (true)',t.tablename);
  END IF;
 END LOOP;
 FOR f IN SELECT p.proname,pg_get_function_identity_arguments(p.oid) AS arguments FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='school_app' LOOP
  EXECUTE format('ALTER FUNCTION school_app.%I(%s) SET search_path=school_app,pg_catalog,pg_temp',f.proname,f.arguments);
 END LOOP;
END $secure$;

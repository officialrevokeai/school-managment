ALTER TABLE sessions ADD COLUMN workspace text NOT NULL DEFAULT 'school' CHECK(workspace IN ('school','platform'));
CREATE TABLE school_deletion_challenges (
 token_hash text PRIMARY KEY, org_id text NOT NULL, actor_id text NOT NULL REFERENCES users(id),
 session_hash text NOT NULL REFERENCES sessions(token_hash) ON DELETE CASCADE,
 reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
 first_confirmed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX school_deletion_expiry ON school_deletion_challenges(expires_at);
-- Every tenant table has a direct ownership link so future deletions cannot leave
-- documents, ledger rows, callbacks, credentials or queued jobs behind.
DO $$ DECLARE t record; c record; BEGIN
 FOR t IN SELECT table_name FROM information_schema.columns WHERE table_schema=current_schema() AND column_name='org_id' LOOP
  FOR c IN SELECT x.conname FROM pg_constraint x JOIN pg_class r ON r.oid=x.conrelid JOIN pg_namespace n ON n.oid=r.relnamespace WHERE n.nspname=current_schema() AND r.relname=t.table_name AND x.contype='f' AND x.confrelid='organizations'::regclass LOOP
   EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I',t.table_name,c.conname);
  END LOOP;
  EXECUTE format('ALTER TABLE %I ADD CONSTRAINT tenant_org_owner FOREIGN KEY(org_id) REFERENCES organizations(id) ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE',t.table_name);
 END LOOP;
 -- Defer relationship checks during the one-statement tenant cascade; this also
 -- handles invoice/order and other cyclic references without disabling integrity.
 FOR c IN SELECT x.conname,r.relname FROM pg_constraint x JOIN pg_class r ON r.oid=x.conrelid JOIN pg_namespace n ON n.oid=r.relnamespace WHERE n.nspname=current_schema() AND x.contype='f' LOOP
  EXECUTE format('ALTER TABLE %I ALTER CONSTRAINT %I DEFERRABLE INITIALLY IMMEDIATE',c.relname,c.conname);
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION prevent_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN
  IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM organizations WHERE id=OLD.org_id) THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'Audit history is append-only';
 END $$;

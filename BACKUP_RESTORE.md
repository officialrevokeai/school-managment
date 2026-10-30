# Backup and recovery

Production backup-main uses a matching pg_dump client, AES-256-GCM with random salt/nonce and a scrypt-derived key, restricted output files, recorded digest/size and validated retention paths. Private bytea file assets are included. The pilot implementation buffers dumps and rejects those over 256 MiB; larger datasets need a reviewed streaming implementation.

Set BACKUP_PASSPHRASE (32+ characters), BACKUP_DIRECTORY, BACKUP_INTERVAL_HOURS (default 24) and BACKUP_RETENTION_DAYS (7–3650, default 30). Keys belong to the operator service. A same-host volume alone is not disaster recovery; provide authorized off-host copying and separate key storage.

Manual backup: node build/scripts/backup.js. Create a new empty isolated database; set RESTORE_DATABASE_URL distinct from DATABASE_URL, and run node build/scripts/restore.js /absolute/path/to/archive.schoolbackup. The file authenticates before plaintext reaches pg_restore. Existing target objects cause failure; the command does not clean an existing database.

Validate migration checksums, record/ledger counts, authorization, file digests and queue behavior before promotion. Disable external providers on restored databases so old jobs cannot send messages. Keep the original environment until cutover/rollback are verified.

Executed: encrypted PostgreSQL-engine PGlite snapshot restored into a separate PGlite instance, preserving students and private file bytes; wrong-key authentication fails. Production pg_dump/pg_restore, off-host replication and measured RPO/RTO remain unverified. No recovery guarantee is claimed.

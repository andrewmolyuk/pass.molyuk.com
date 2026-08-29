CREATE TABLE IF NOT EXISTS secrets (
  id TEXT PRIMARY KEY,
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5
);

CREATE INDEX IF NOT EXISTS idx_secrets_expires_at ON secrets (expires_at);

CREATE TABLE IF NOT EXISTS attempt_failed_log (
  ip TEXT NOT NULL,
  ts INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attempt_log_ip_ts ON attempt_failed_log (ip, ts);

import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';

let db: Database.Database;

export function initDatabase(): Database.Database {
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'token-monitor.db');

  // Ensure directory exists
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  db = new Database(dbPath);

  // Performance optimizations
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('cache_size = -64000'); // 64MB cache
  db.pragma('foreign_keys = ON');

  // Run migrations
  runMigrations(db);

  return db;
}

function runMigrations(db: Database.Database) {
  db.exec(`
    -- Settings table for app preferences
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Providers configured by the user
    CREATE TABLE IF NOT EXISTS providers (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      config TEXT,
      is_estimated INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Individual usage records
    CREATE TABLE IF NOT EXISTS usage_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_id TEXT NOT NULL REFERENCES providers(id),
      timestamp DATETIME NOT NULL,
      model TEXT,
      input_tokens INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      cache_read_tokens INTEGER DEFAULT 0,
      cache_write_tokens INTEGER DEFAULT 0,
      reasoning_tokens INTEGER DEFAULT 0,
      cost_usd REAL,
      is_estimated INTEGER DEFAULT 0,
      instance_id TEXT,
      session_id TEXT,
      request_id TEXT,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Hourly aggregation for fast dashboard queries
    CREATE TABLE IF NOT EXISTS usage_hourly (
      provider_id TEXT NOT NULL REFERENCES providers(id),
      hour DATETIME NOT NULL,
      model TEXT,
      total_input_tokens INTEGER DEFAULT 0,
      total_output_tokens INTEGER DEFAULT 0,
      total_cache_tokens INTEGER DEFAULT 0,
      total_cost_usd REAL DEFAULT 0,
      request_count INTEGER DEFAULT 0,
      PRIMARY KEY (provider_id, hour, model)
    );

    -- Daily aggregation for history/analytics
    CREATE TABLE IF NOT EXISTS usage_daily (
      provider_id TEXT NOT NULL REFERENCES providers(id),
      date DATE NOT NULL,
      model TEXT,
      total_input_tokens INTEGER DEFAULT 0,
      total_output_tokens INTEGER DEFAULT 0,
      total_cost_usd REAL DEFAULT 0,
      request_count INTEGER DEFAULT 0,
      PRIMARY KEY (provider_id, date, model)
    );

    -- Budget alerts configuration
    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      provider_id TEXT,
      period TEXT NOT NULL,
      limit_usd REAL NOT NULL,
      alert_thresholds TEXT DEFAULT '[75, 90, 100]',
      notify_channels TEXT DEFAULT '["push"]',
      is_hard_cap INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_usage_provider_time ON usage_records(provider_id, timestamp);
    CREATE INDEX IF NOT EXISTS idx_usage_model ON usage_records(model, timestamp);
    CREATE INDEX IF NOT EXISTS idx_usage_instance ON usage_records(instance_id, timestamp);
    CREATE INDEX IF NOT EXISTS idx_usage_session ON usage_records(session_id, timestamp);
    CREATE INDEX IF NOT EXISTS idx_hourly_time ON usage_hourly(hour);
    CREATE INDEX IF NOT EXISTS idx_daily_date ON usage_daily(date);
  `);

  // Check schema version and run incremental migrations
  const versionRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('schema_version') as any;
  const currentVersion = versionRow ? parseInt(versionRow.value, 10) : 0;

  if (currentVersion < 1) {
    db.prepare(
      `INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('schema_version', '1', datetime('now'))`
    ).run();
  }
}

// ─── Query Helpers ───────────────────────────────────────────────

export function insertUsageRecord(
  db: Database.Database,
  record: {
    providerId: string;
    timestamp: string;
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
    reasoningTokens?: number;
    costUsd?: number;
    isEstimated?: boolean;
    instanceId?: string;
    sessionId?: string;
    requestId?: string;
    metadata?: Record<string, unknown>;
  }
) {
  const stmt = db.prepare(
    `INSERT INTO usage_records
      (provider_id, timestamp, model, input_tokens, output_tokens,
       cache_read_tokens, cache_write_tokens, reasoning_tokens,
       cost_usd, is_estimated, instance_id, session_id, request_id, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  stmt.run(
    record.providerId,
    record.timestamp,
    record.model || null,
    record.inputTokens || 0,
    record.outputTokens || 0,
    record.cacheReadTokens || 0,
    record.cacheWriteTokens || 0,
    record.reasoningTokens || 0,
    record.costUsd || null,
    record.isEstimated ? 1 : 0,
    record.instanceId || null,
    record.sessionId || null,
    record.requestId || null,
    record.metadata ? JSON.stringify(record.metadata) : null
  );

  // Update hourly aggregate
  const hour = record.timestamp.substring(0, 13) + ':00:00';
  db.prepare(
    `INSERT INTO usage_hourly (provider_id, hour, model, total_input_tokens, total_output_tokens, total_cache_tokens, total_cost_usd, request_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)
     ON CONFLICT(provider_id, hour, model) DO UPDATE SET
       total_input_tokens = total_input_tokens + excluded.total_input_tokens,
       total_output_tokens = total_output_tokens + excluded.total_output_tokens,
       total_cache_tokens = total_cache_tokens + excluded.total_cache_tokens,
       total_cost_usd = total_cost_usd + COALESCE(excluded.total_cost_usd, 0),
       request_count = request_count + 1`
  ).run(
    record.providerId,
    hour,
    record.model || 'unknown',
    record.inputTokens || 0,
    record.outputTokens || 0,
    (record.cacheReadTokens || 0) + (record.cacheWriteTokens || 0),
    record.costUsd || 0
  );

  // Update daily aggregate
  const date = record.timestamp.substring(0, 10);
  db.prepare(
    `INSERT INTO usage_daily (provider_id, date, model, total_input_tokens, total_output_tokens, total_cost_usd, request_count)
     VALUES (?, ?, ?, ?, ?, ?, 1)
     ON CONFLICT(provider_id, date, model) DO UPDATE SET
       total_input_tokens = total_input_tokens + excluded.total_input_tokens,
       total_output_tokens = total_output_tokens + excluded.total_output_tokens,
       total_cost_usd = total_cost_usd + COALESCE(excluded.total_cost_usd, 0),
       request_count = request_count + 1`
  ).run(
    record.providerId,
    date,
    record.model || 'unknown',
    record.inputTokens || 0,
    record.outputTokens || 0,
    record.costUsd || 0
  );
}

export function getTodayStats(db: Database.Database, providerId?: string) {
  const today = new Date().toISOString().substring(0, 10);
  let sql = `
    SELECT
      COALESCE(SUM(total_input_tokens), 0) as totalInputTokens,
      COALESCE(SUM(total_output_tokens), 0) as totalOutputTokens,
      COALESCE(SUM(total_cost_usd), 0) as totalCostUsd,
      COALESCE(SUM(request_count), 0) as requestCount
    FROM usage_daily
    WHERE date = ?
  `;
  const params: any[] = [today];

  if (providerId) {
    sql += ' AND provider_id = ?';
    params.push(providerId);
  }

  return db.prepare(sql).get(...params);
}

export function getSparklineData(db: Database.Database, providerId: string, points = 24) {
  const rows = db.prepare(
    `SELECT total_cost_usd as value FROM usage_hourly
     WHERE provider_id = ?
     ORDER BY hour DESC LIMIT ?`
  ).all(providerId, points) as { value: number }[];

  return rows.map(r => r.value).reverse();
}

export { db };

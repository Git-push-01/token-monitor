import { ipcMain, safeStorage } from 'electron';
import type Database from 'better-sqlite3';
import type { DataEngine } from '../services/engine';
import { v4 as uuid } from 'uuid';

export function registerIpcHandlers(db: Database.Database, engine: DataEngine) {
  // ─── Providers ─────────────────────────────────────────────

  ipcMain.handle('providers:list', () => {
    return db.prepare('SELECT * FROM providers WHERE status != ?').all('deleted');
  });

  ipcMain.handle('providers:add', (_event, provider) => {
    const id = uuid();
    // Encrypt sensitive config (API keys) using OS keychain
    let encryptedConfig = null;
    if (provider.config) {
      const configStr = JSON.stringify(provider.config);
      if (safeStorage.isEncryptionAvailable()) {
        encryptedConfig = safeStorage.encryptString(configStr).toString('base64');
      } else {
        encryptedConfig = configStr; // fallback (not ideal)
      }
    }

    db.prepare(
      `INSERT INTO providers (id, type, name, config, is_estimated, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'active', datetime('now'), datetime('now'))`
    ).run(id, provider.type, provider.name, encryptedConfig, provider.isEstimated ? 1 : 0);

    // Tell engine to start tracking this provider
    engine.addProvider({ id, ...provider });

    return { id, ...provider, status: 'active' };
  });

  ipcMain.handle('providers:update', (_event, id, data) => {
    const sets: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      sets.push('name = ?');
      values.push(data.name);
    }
    if (data.status !== undefined) {
      sets.push('status = ?');
      values.push(data.status);
    }
    if (data.config !== undefined) {
      const configStr = JSON.stringify(data.config);
      if (safeStorage.isEncryptionAvailable()) {
        sets.push('config = ?');
        values.push(safeStorage.encryptString(configStr).toString('base64'));
      } else {
        sets.push('config = ?');
        values.push(configStr);
      }
    }

    sets.push("updated_at = datetime('now')");
    values.push(id);

    db.prepare(`UPDATE providers SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return { success: true };
  });

  ipcMain.handle('providers:remove', (_event, id) => {
    db.prepare("UPDATE providers SET status = 'deleted', updated_at = datetime('now') WHERE id = ?").run(id);
    engine.removeProvider(id);
    return { success: true };
  });

  ipcMain.handle('providers:test', async (_event, type, config) => {
    try {
      const result = await engine.testConnection(type, config);
      return { success: true, ...result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ─── Usage Data ────────────────────────────────────────────

  ipcMain.handle('usage:stats', (_event, query) => {
    const { providerId, period, startDate, endDate } = query || {};
    let sql = '';
    const params: any[] = [];

    if (period === 'hour') {
      sql = `SELECT * FROM usage_hourly WHERE 1=1`;
    } else {
      sql = `SELECT * FROM usage_daily WHERE 1=1`;
    }

    if (providerId) {
      sql += ' AND provider_id = ?';
      params.push(providerId);
    }
    if (startDate) {
      sql += period === 'hour' ? ' AND hour >= ?' : ' AND date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += period === 'hour' ? ' AND hour <= ?' : ' AND date <= ?';
      params.push(endDate);
    }

    sql += period === 'hour' ? ' ORDER BY hour DESC' : ' ORDER BY date DESC';
    sql += ' LIMIT 1000';

    return db.prepare(sql).all(...params);
  });

  ipcMain.handle('usage:history', (_event, query) => {
    const { providerId, model, limit = 100, offset = 0 } = query || {};
    let sql = 'SELECT * FROM usage_records WHERE 1=1';
    const params: any[] = [];

    if (providerId) {
      sql += ' AND provider_id = ?';
      params.push(providerId);
    }
    if (model) {
      sql += ' AND model = ?';
      params.push(model);
    }

    sql += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return db.prepare(sql).all(...params);
  });

  ipcMain.handle('usage:instances', () => {
    return engine.getInstances();
  });

  // ─── Settings ──────────────────────────────────────────────

  ipcMain.handle('settings:get', () => {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('user_preferences') as any;
    return row ? JSON.parse(row.value) : null;
  });

  ipcMain.handle('settings:update', (_event, settings) => {
    db.prepare(
      `INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('user_preferences', ?, datetime('now'))`
    ).run(JSON.stringify(settings));
    return { success: true };
  });

  // ─── Budgets ───────────────────────────────────────────────

  ipcMain.handle('budgets:list', () => {
    return db.prepare('SELECT * FROM budgets').all();
  });

  ipcMain.handle('budgets:add', (_event, budget) => {
    const id = uuid();
    db.prepare(
      `INSERT INTO budgets (id, name, provider_id, period, limit_usd, alert_thresholds, notify_channels, is_hard_cap, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).run(
      id,
      budget.name,
      budget.providerId || null,
      budget.period,
      budget.limitUsd,
      JSON.stringify(budget.thresholds || [75, 90, 100]),
      JSON.stringify(budget.notifyChannels || ['push']),
      budget.isHardCap ? 1 : 0
    );
    return { id, ...budget };
  });

  ipcMain.handle('budgets:update', (_event, id, data) => {
    const sets: string[] = [];
    const values: any[] = [];

    for (const [key, val] of Object.entries(data)) {
      if (key === 'thresholds' || key === 'notifyChannels') {
        sets.push(`${key === 'thresholds' ? 'alert_thresholds' : 'notify_channels'} = ?`);
        values.push(JSON.stringify(val));
      } else {
        const col = key.replace(/[A-Z]/g, c => '_' + c.toLowerCase());
        sets.push(`${col} = ?`);
        values.push(val);
      }
    }
    values.push(id);

    db.prepare(`UPDATE budgets SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return { success: true };
  });

  ipcMain.handle('budgets:remove', (_event, id) => {
    db.prepare('DELETE FROM budgets WHERE id = ?').run(id);
    return { success: true };
  });

  // ─── Pairing ───────────────────────────────────────────────

  ipcMain.handle('pairing:token', () => {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('pairing_token') as any;
    if (row) return row.value;

    const token = uuid().replace(/-/g, '').substring(0, 12).toUpperCase();
    db.prepare(
      `INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('pairing_token', ?, datetime('now'))`
    ).run(token);
    return token;
  });

  ipcMain.handle('pairing:reset', () => {
    const token = uuid().replace(/-/g, '').substring(0, 12).toUpperCase();
    db.prepare(
      `INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('pairing_token', ?, datetime('now'))`
    ).run(token);
    return token;
  });

  // ─── Export ────────────────────────────────────────────────

  ipcMain.handle('export:csv', (_event, query) => {
    const records = db.prepare(
      'SELECT * FROM usage_records WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp'
    ).all(query.startDate, query.endDate);
    return recordsToCSV(records as any[]);
  });

  ipcMain.handle('export:json', (_event, query) => {
    const records = db.prepare(
      'SELECT * FROM usage_records WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp'
    ).all(query.startDate, query.endDate);
    return JSON.stringify(records, null, 2);
  });
}

function recordsToCSV(records: any[]): string {
  if (records.length === 0) return '';
  const headers = Object.keys(records[0]);
  const rows = records.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','));
  return [headers.join(','), ...rows].join('\n');
}

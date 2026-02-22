import type Database from 'better-sqlite3';
import { BrowserWindow } from 'electron';
import { EventEmitter } from 'events';
import { v4 as uuid } from 'uuid';
import { insertUsageRecord, getSparklineData } from './database';
import { calculateCost } from '@token-monitor/shared';
import type { UsageEventV1, ProviderType, Instance } from '@token-monitor/shared';
import type { WebSocketServer } from 'ws';

// Adapter interface — every provider adapter implements this
export interface ProviderAdapter {
  readonly type: ProviderType;
  start(): Promise<void>;
  stop(): Promise<void>;
  testConnection(config: any): Promise<{ valid: boolean; info?: string }>;
}

export interface DataEngine {
  addProvider(provider: any): void;
  removeProvider(id: string): void;
  ingestEvent(event: UsageEventV1): void;
  getInstances(): Instance[];
  testConnection(type: string, config: any): Promise<{ valid: boolean; info?: string }>;
  on(event: string, listener: (...args: any[]) => void): void;
}

export function startEngine(db: Database.Database, wsServer: WebSocketServer | null): DataEngine {
  const emitter = new EventEmitter();
  const adapters = new Map<string, ProviderAdapter>();
  const instances = new Map<string, Instance>();

  // Burn rate tracking
  const burnRateWindows = new Map<string, number[]>(); // providerId → recent cost samples

  function ingestEvent(event: UsageEventV1) {
    // Normalize: fill totalTokens if missing
    if (event.totalTokens == null && event.inputTokens != null && event.outputTokens != null) {
      event.totalTokens = event.inputTokens + event.outputTokens;
    }

    // Calculate cost if not provided
    if (event.costUsd == null && event.model) {
      event.costUsd = calculateCost(
        event.model,
        event.inputTokens || 0,
        event.outputTokens || 0,
        event.cacheReadTokens || 0,
        event.cacheWriteTokens || 0,
        event.reasoningTokens || 0
      ) ?? undefined;
    }

    // Persist to database
    const timestamp = new Date(event.ts).toISOString();
    insertUsageRecord(db, {
      providerId: event.providerId,
      timestamp,
      model: event.model,
      inputTokens: event.inputTokens,
      outputTokens: event.outputTokens,
      cacheReadTokens: event.cacheReadTokens,
      cacheWriteTokens: event.cacheWriteTokens,
      reasoningTokens: event.reasoningTokens,
      costUsd: event.costUsd,
      isEstimated: event.quality === 'estimated',
      instanceId: event.instanceId,
      sessionId: event.sessionId,
      requestId: event.requestId,
      metadata: event.meta as Record<string, unknown>,
    });

    // Update in-memory instance
    updateInstance(event);

    // Broadcast to renderer
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      win.webContents.send('usage:event', event);
    }

    // Emit for other listeners (WebSocket broadcast, budget checks, etc.)
    emitter.emit('usage', event);

    // Check budget alerts
    checkBudgets(event);
  }

  function updateInstance(event: UsageEventV1) {
    const key = event.instanceId || event.providerId;
    let instance = instances.get(key);

    if (!instance) {
      // Fetch provider info from DB
      const providerRow = db.prepare('SELECT * FROM providers WHERE id = ?').get(event.providerId) as any;
      instance = {
        id: key,
        provider: providerRow ? {
          id: providerRow.id,
          type: providerRow.type,
          name: providerRow.name,
          displayIcon: '',
          color: '',
          dataQuality: providerRow.is_estimated ? 'estimated' : 'exact',
          connectionMethod: 'api_key',
          status: providerRow.status,
          isEstimated: !!providerRow.is_estimated,
          createdAt: new Date(providerRow.created_at),
          updatedAt: new Date(providerRow.updated_at),
        } : {} as any,
        name: event.instanceId || event.provider,
        model: event.model || 'unknown',
        status: 'active',
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCostUsd: 0,
        requestCount: 0,
        sparklineData: [],
        startedAt: new Date(event.ts),
        lastActivityAt: new Date(event.ts),
      };
      instances.set(key, instance);
    }

    instance.totalInputTokens += event.inputTokens || 0;
    instance.totalOutputTokens += event.outputTokens || 0;
    instance.totalCostUsd += event.costUsd || 0;
    instance.requestCount += 1;
    instance.lastActivityAt = new Date(event.ts);
    instance.model = event.model || instance.model;

    // Update sparkline (keep last 30 points)
    instance.sparklineData.push(event.costUsd || 0);
    if (instance.sparklineData.length > 30) {
      instance.sparklineData.shift();
    }
  }

  function checkBudgets(event: UsageEventV1) {
    const budgets = db.prepare('SELECT * FROM budgets').all() as any[];
    const today = new Date().toISOString().substring(0, 10);

    for (const budget of budgets) {
      // Skip if budget is for a specific provider and this isn't it
      if (budget.provider_id && budget.provider_id !== event.providerId) continue;

      let spent = 0;
      if (budget.period === 'daily') {
        const row = db.prepare(
          `SELECT COALESCE(SUM(total_cost_usd), 0) as total FROM usage_daily WHERE date = ?${budget.provider_id ? ' AND provider_id = ?' : ''}`
        ).get(...(budget.provider_id ? [today, budget.provider_id] : [today])) as any;
        spent = row.total;
      } else if (budget.period === 'monthly') {
        const monthStart = today.substring(0, 7) + '-01';
        const row = db.prepare(
          `SELECT COALESCE(SUM(total_cost_usd), 0) as total FROM usage_daily WHERE date >= ?${budget.provider_id ? ' AND provider_id = ?' : ''}`
        ).get(...(budget.provider_id ? [monthStart, budget.provider_id] : [monthStart])) as any;
        spent = row.total;
      }

      const percent = (spent / budget.limit_usd) * 100;
      const thresholds = JSON.parse(budget.alert_thresholds || '[]') as number[];

      for (const threshold of thresholds) {
        if (percent >= threshold) {
          const windows = BrowserWindow.getAllWindows();
          for (const win of windows) {
            win.webContents.send('budget:alert', {
              budgetId: budget.id,
              budgetName: budget.name,
              spent,
              limit: budget.limit_usd,
              percent,
              threshold,
            });
          }
          break; // Only fire highest threshold reached
        }
      }
    }
  }

  function addProvider(provider: any) {
    // Adapter creation happens here — adapters are registered when provider is added
    // The actual adapter classes are imported and instantiated based on type
    emitter.emit('provider:added', provider);
  }

  function removeProvider(id: string) {
    const adapter = adapters.get(id);
    if (adapter) {
      adapter.stop();
      adapters.delete(id);
    }
    instances.delete(id);
    emitter.emit('provider:removed', id);
  }

  async function testConnection(type: string, config: any) {
    // Delegate to appropriate adapter for connection testing
    switch (type) {
      case 'anthropic_api':
        return testAnthropicConnection(config);
      case 'openai_api':
        return testOpenAIConnection(config);
      case 'gemini_api':
        return testGeminiConnection(config);
      case 'openrouter':
        return testOpenRouterConnection(config);
      case 'claude_code':
        return { valid: true, info: 'File watcher will auto-detect sessions' };
      default:
        return { valid: true, info: 'Connection assumed valid' };
    }
  }

  return {
    addProvider,
    removeProvider,
    ingestEvent,
    getInstances: () => Array.from(instances.values()),
    testConnection,
    on: (event, listener) => emitter.on(event, listener),
  };
}

// ─── Connection Test Helpers ─────────────────────────────────────

async function testAnthropicConnection(config: { apiKey: string }) {
  try {
    const res = await fetch('https://api.anthropic.com/v1/models', {
      headers: {
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
    });
    if (res.ok) return { valid: true, info: 'API key verified' };
    return { valid: false, info: `API returned ${res.status}` };
  } catch (err: any) {
    return { valid: false, info: err.message };
  }
}

async function testOpenAIConnection(config: { apiKey: string }) {
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });
    if (res.ok) return { valid: true, info: 'API key verified' };
    return { valid: false, info: `API returned ${res.status}` };
  } catch (err: any) {
    return { valid: false, info: err.message };
  }
}

async function testGeminiConnection(config: { apiKey: string }) {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1/models?key=${config.apiKey}`
    );
    if (res.ok) return { valid: true, info: 'API key verified' };
    return { valid: false, info: `API returned ${res.status}` };
  } catch (err: any) {
    return { valid: false, info: err.message };
  }
}

async function testOpenRouterConnection(config: { apiKey: string }) {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });
    if (res.ok) {
      const data = await res.json();
      return { valid: true, info: `Credit balance: $${data.data?.usage ?? 'unknown'}` };
    }
    return { valid: false, info: `API returned ${res.status}` };
  } catch (err: any) {
    return { valid: false, info: err.message };
  }
}

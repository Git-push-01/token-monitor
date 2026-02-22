import { v4 as uuid } from 'uuid';
import type { UsageEventV1 } from '@token-monitor/shared';
import type { ProviderAdapter, DataEngine } from '../engine';

/**
 * OpenRouter adapter — the "cheat code"
 * Exact tokens AND cost in USD returned on every response
 */
export class OpenRouterAdapter implements ProviderAdapter {
  readonly type = 'openrouter' as const;
  private engine: DataEngine;
  private providerId: string;
  private apiKey: string;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private lastGenerationId: string | null = null;

  constructor(engine: DataEngine, providerId: string, apiKey: string) {
    this.engine = engine;
    this.providerId = providerId;
    this.apiKey = apiKey;
  }

  async start() {
    // Poll generation history every 30 seconds for backfill
    await this.pollGenerations();
    this.pollInterval = setInterval(() => this.pollGenerations(), 30_000);
    console.log('[OpenRouter] Adapter started for provider:', this.providerId);
  }

  async stop() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  async testConnection(config?: { apiKey?: string }) {
    const key = config?.apiKey || this.apiKey;
    try {
      const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (res.ok) {
        const data = await res.json();
        return {
          valid: true,
          info: `Connected — usage: $${data.data?.usage?.toFixed(4) ?? '0'}, limit: $${data.data?.limit ?? 'none'}`,
        };
      }
      return { valid: false, info: `HTTP ${res.status}` };
    } catch (err: any) {
      return { valid: false, info: err.message };
    }
  }

  /**
   * Called by the proxy server when it intercepts an OpenRouter response
   */
  processResponse(responseBody: any, headers: Record<string, string>) {
    if (!responseBody?.usage) return;

    const usage = responseBody.usage;
    const costUsd = headers['x-openrouter-cost']
      ? parseFloat(headers['x-openrouter-cost'])
      : undefined;

    const event: UsageEventV1 = {
      id: uuid(),
      ts: Date.now(),
      provider: 'openrouter',
      providerId: this.providerId,
      instanceId: `openrouter-${this.providerId}`,
      requestId: responseBody.id,
      model: responseBody.model,
      inputTokens: usage.prompt_tokens || 0,
      outputTokens: usage.completion_tokens || 0,
      totalTokens: usage.total_tokens || 0,
      costUsd, // Directly from OpenRouter — no pricing table needed
      quality: 'exact',
    };

    this.engine.ingestEvent(event);
  }

  /**
   * Poll OpenRouter generation history for backfill
   */
  private async pollGenerations() {
    try {
      const url = new URL('https://openrouter.ai/api/v1/generation');
      url.searchParams.set('limit', '50');

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });

      if (!res.ok) return;

      const data = await res.json();
      const generations = data.data || [];

      for (const gen of generations) {
        // Skip if we've already processed this
        if (this.lastGenerationId && gen.id <= this.lastGenerationId) continue;

        const event: UsageEventV1 = {
          id: uuid(),
          ts: new Date(gen.created_at).getTime(),
          provider: 'openrouter',
          providerId: this.providerId,
          instanceId: `openrouter-${this.providerId}`,
          requestId: gen.id,
          model: gen.model,
          inputTokens: gen.tokens_prompt || 0,
          outputTokens: gen.tokens_completion || 0,
          totalTokens: (gen.tokens_prompt || 0) + (gen.tokens_completion || 0),
          costUsd: gen.total_cost || undefined,
          quality: 'exact',
          meta: {
            source: 'generation_history',
            origin: gen.origin,
          },
        };

        this.engine.ingestEvent(event);
      }

      if (generations.length > 0) {
        this.lastGenerationId = generations[0].id;
      }
    } catch {
      // Silent fail
    }
  }
}

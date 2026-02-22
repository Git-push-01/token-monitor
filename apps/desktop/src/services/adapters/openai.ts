import { v4 as uuid } from 'uuid';
import { calculateCost } from '@token-monitor/shared';
import type { UsageEventV1 } from '@token-monitor/shared';
import type { ProviderAdapter, DataEngine } from '../engine';

/**
 * OpenAI API adapter
 * Tracks usage via proxy intercept or usage API polling
 */
export class OpenAIAdapter implements ProviderAdapter {
  readonly type = 'openai_api' as const;
  private engine: DataEngine;
  private providerId: string;
  private apiKey: string;
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  constructor(engine: DataEngine, providerId: string, apiKey: string) {
    this.engine = engine;
    this.providerId = providerId;
    this.apiKey = apiKey;
  }

  async start() {
    // Start polling OpenAI usage API for historical data
    this.pollUsageAPI();
    this.pollInterval = setInterval(() => this.pollUsageAPI(), 5 * 60 * 1000); // every 5 min
    console.log('[OpenAI] Adapter started for provider:', this.providerId);
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
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (res.ok) return { valid: true, info: 'API key verified' };
      return { valid: false, info: `HTTP ${res.status}` };
    } catch (err: any) {
      return { valid: false, info: err.message };
    }
  }

  /**
   * Called by the proxy server when it intercepts an OpenAI API response
   */
  processResponse(responseBody: any, model: string) {
    if (!responseBody?.usage) return;

    const usage = responseBody.usage;
    const reasoningTokens = usage.completion_tokens_details?.reasoning_tokens || 0;

    const event: UsageEventV1 = {
      id: uuid(),
      ts: Date.now(),
      provider: 'openai_api',
      providerId: this.providerId,
      instanceId: `openai-${this.providerId}`,
      requestId: responseBody.id,
      model: model || responseBody.model,
      inputTokens: usage.prompt_tokens || 0,
      outputTokens: usage.completion_tokens || 0,
      reasoningTokens,
      costUsd: calculateCost(
        model || responseBody.model,
        usage.prompt_tokens || 0,
        usage.completion_tokens || 0,
        0, 0,
        reasoningTokens
      ) ?? undefined,
      quality: 'exact',
    };

    this.engine.ingestEvent(event);
  }

  private async pollUsageAPI() {
    try {
      // OpenAI Usage API: GET /v1/organization/usage/completions
      const endTime = Math.floor(Date.now() / 1000);
      const startTime = endTime - 86400; // Last 24 hours

      const res = await fetch(
        `https://api.openai.com/v1/organization/usage/completions?start_time=${startTime}&end_time=${endTime}&group_by[]=model`,
        { headers: { Authorization: `Bearer ${this.apiKey}` } }
      );

      if (!res.ok) {
        // Usage API requires admin key — fail silently
        return;
      }

      // Process historical data if available
      // This is a best-effort backfill
    } catch {
      // Silent fail — usage API may not be available
    }
  }
}

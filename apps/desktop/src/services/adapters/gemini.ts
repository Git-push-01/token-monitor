import { v4 as uuid } from 'uuid';
import { calculateCost } from '@token-monitor/shared';
import type { UsageEventV1 } from '@token-monitor/shared';
import type { ProviderAdapter, DataEngine } from '../engine';

/**
 * Gemini API adapter
 * Tracks usage via proxy intercept
 */
export class GeminiAdapter implements ProviderAdapter {
  readonly type = 'gemini_api' as const;
  private engine: DataEngine;
  private providerId: string;
  private apiKey: string;

  constructor(engine: DataEngine, providerId: string, apiKey: string) {
    this.engine = engine;
    this.providerId = providerId;
    this.apiKey = apiKey;
  }

  async start() {
    console.log('[Gemini] Adapter started for provider:', this.providerId);
  }

  async stop() {
    // No cleanup needed
  }

  async testConnection(config?: { apiKey?: string }) {
    const key = config?.apiKey || this.apiKey;
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1/models?key=${key}`
      );
      if (res.ok) return { valid: true, info: 'API key verified' };
      return { valid: false, info: `HTTP ${res.status}` };
    } catch (err: any) {
      return { valid: false, info: err.message };
    }
  }

  /**
   * Called by the proxy server when it intercepts a Gemini API response
   */
  processResponse(responseBody: any, model: string) {
    const usageMetadata = responseBody?.usageMetadata;
    if (!usageMetadata) return;

    const event: UsageEventV1 = {
      id: uuid(),
      ts: Date.now(),
      provider: 'gemini_api',
      providerId: this.providerId,
      instanceId: `gemini-${this.providerId}`,
      model,
      inputTokens: usageMetadata.promptTokenCount || 0,
      outputTokens: usageMetadata.candidatesTokenCount || 0,
      cacheReadTokens: usageMetadata.cachedContentTokenCount || 0,
      totalTokens: usageMetadata.totalTokenCount || 0,
      costUsd: calculateCost(
        model,
        usageMetadata.promptTokenCount || 0,
        usageMetadata.candidatesTokenCount || 0,
        usageMetadata.cachedContentTokenCount || 0
      ) ?? undefined,
      quality: 'exact',
    };

    this.engine.ingestEvent(event);
  }
}

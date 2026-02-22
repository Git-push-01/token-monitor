// ─── Model Pricing Tables ────────────────────────────────────────
// Prices in USD per 1M tokens unless noted otherwise
// Last updated: 2025-06-01

export interface ModelPricing {
  input: number;
  output: number;
  cache_read?: number;
  cache_write?: number;
  thinking_input?: number;
  thinking_output?: number;
}

export const PRICING: Record<string, ModelPricing> = {
  // ─── ANTHROPIC ───────────────────────────────────────────────
  'claude-opus-4': { input: 15, output: 75, cache_read: 1.5, cache_write: 18.75 },
  'claude-opus-4-20250514': { input: 15, output: 75, cache_read: 1.5, cache_write: 18.75 },
  'claude-sonnet-4': { input: 3, output: 15, cache_read: 0.3, cache_write: 3.75 },
  'claude-sonnet-4-20250514': { input: 3, output: 15, cache_read: 0.3, cache_write: 3.75 },
  'claude-3.5-sonnet': { input: 3, output: 15, cache_read: 0.3, cache_write: 3.75 },
  'claude-3-5-sonnet-20241022': { input: 3, output: 15, cache_read: 0.3, cache_write: 3.75 },
  'claude-haiku-3.5': { input: 0.8, output: 4, cache_read: 0.08, cache_write: 1 },
  'claude-3-5-haiku-20241022': { input: 0.8, output: 4, cache_read: 0.08, cache_write: 1 },

  // ─── OPENAI ──────────────────────────────────────────────────
  'gpt-4.1': { input: 2, output: 8 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
  'gpt-4.1-nano': { input: 0.1, output: 0.4 },
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'o3': { input: 2, output: 8 },
  'o3-mini': { input: 1.1, output: 4.4 },
  'o4-mini': { input: 1.1, output: 4.4 },

  // ─── GOOGLE ──────────────────────────────────────────────────
  'gemini-2.5-pro': { input: 1.25, output: 10, cache_read: 0.3125 },
  'gemini-2.5-flash': { input: 0.15, output: 0.6, thinking_input: 0.15, thinking_output: 3.5 },
  'gemini-2.0-flash': { input: 0.1, output: 0.4 },
  'gemini-1.5-pro': { input: 1.25, output: 5 },
  'gemini-1.5-flash': { input: 0.075, output: 0.3 },
};

// ─── GitHub Copilot Premium Request Multipliers ──────────────────

export const COPILOT_MULTIPLIERS: Record<string, number> = {
  'gpt-4.1': 1,
  'claude-sonnet-4': 1,
  'o3': 1,
  'gemini-2.5-pro': 1,
};

// ─── Cost Calculation ────────────────────────────────────────────

export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens = 0,
  cacheWriteTokens = 0,
  reasoningTokens = 0,
): number | null {
  const pricing = PRICING[model];
  if (!pricing) return null;

  const PER_MILLION = 1_000_000;
  let cost = 0;

  cost += (inputTokens / PER_MILLION) * pricing.input;
  cost += (outputTokens / PER_MILLION) * pricing.output;

  if (cacheReadTokens > 0 && pricing.cache_read) {
    cost += (cacheReadTokens / PER_MILLION) * pricing.cache_read;
  }
  if (cacheWriteTokens > 0 && pricing.cache_write) {
    cost += (cacheWriteTokens / PER_MILLION) * pricing.cache_write;
  }
  // Reasoning tokens (o-series) are billed at output rate
  if (reasoningTokens > 0) {
    cost += (reasoningTokens / PER_MILLION) * pricing.output;
  }

  return Math.round(cost * 1_000_000) / 1_000_000; // 6 decimal precision
}

/**
 * Try to find pricing for a model by attempting progressively shorter prefixes
 * e.g. "claude-sonnet-4-20250514" → "claude-sonnet-4"
 */
export function findModelPricing(model: string): ModelPricing | null {
  if (PRICING[model]) return PRICING[model];

  // Try without date suffix (e.g., "claude-sonnet-4-20250514" → "claude-sonnet-4")
  const withoutDate = model.replace(/-\d{8}$/, '');
  if (PRICING[withoutDate]) return PRICING[withoutDate];

  // Try base name matching
  const keys = Object.keys(PRICING);
  for (const key of keys) {
    if (model.startsWith(key) || model.includes(key)) {
      return PRICING[key];
    }
  }

  return null;
}

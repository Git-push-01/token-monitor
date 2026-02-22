/**
 * Token estimation utilities for consumer app browser extension data
 * Uses approximate BPE tokenization for estimating token counts from raw text
 */

// Rough character-based estimation when no tokenizer is available
// ~1 token ≈ 4 characters for English, ~1.3 tokens per word
const CHARS_PER_TOKEN = 4;

/**
 * Estimate token count from text using character-based approximation
 * This is the fallback when gpt-tokenizer is not available
 * ~85% accurate for English text
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * More accurate estimation using word-based heuristic
 * Accounts for code, punctuation, and whitespace
 */
export function estimateTokensDetailed(text: string): {
  tokens: number;
  confidence: number; // 0-1
} {
  if (!text) return { tokens: 0, confidence: 1 };

  // Split text into segments
  const words = text.split(/\s+/).filter(Boolean);
  const codeBlocks = (text.match(/```[\s\S]*?```/g) || []).length;

  let tokenEstimate = 0;

  // Words → tokens (average 1.3 tokens per word)
  tokenEstimate += words.length * 1.3;

  // Account for code blocks (typically denser tokenization)
  tokenEstimate += codeBlocks * 5;

  // Account for special characters and punctuation
  const specialChars = (text.match(/[^a-zA-Z0-9\s]/g) || []).length;
  tokenEstimate += specialChars * 0.5;

  // Confidence based on text characteristics
  let confidence = 0.85;
  if (codeBlocks > 0) confidence -= 0.05; // Code is harder to estimate
  if (text.length < 50) confidence -= 0.1; // Short text is less predictable
  if (specialChars / text.length > 0.3) confidence -= 0.1; // Heavy special chars

  return {
    tokens: Math.ceil(tokenEstimate),
    confidence: Math.max(0.5, Math.min(1, confidence)),
  };
}

/**
 * Format token count for display
 */
export function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toString();
}

/**
 * Format cost for display
 */
export function formatCost(usd: number): string {
  if (usd >= 100) return `$${usd.toFixed(0)}`;
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  if (usd >= 0.01) return `$${usd.toFixed(3)}`;
  if (usd >= 0.001) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(6)}`;
}

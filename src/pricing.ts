export interface ModelPricing {
  inputPerMToken: number;
  outputPerMToken: number;
  cacheWritePerMToken: number;
  cacheReadPerMToken: number;
}

export interface TokenCounts {
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
}

// Last updated: 2025-05-14
// Source: https://docs.anthropic.com/en/docs/about-claude/models#model-comparison
const PRICING_TABLE = new Map<string, ModelPricing>([
  // Opus 4 family
  ['claude-opus-4-0', { inputPerMToken: 15, outputPerMToken: 75, cacheWritePerMToken: 18.75, cacheReadPerMToken: 1.50 }],
  ['claude-opus-4-5', { inputPerMToken: 15, outputPerMToken: 75, cacheWritePerMToken: 18.75, cacheReadPerMToken: 1.50 }],
  ['claude-opus-4-6', { inputPerMToken: 15, outputPerMToken: 75, cacheWritePerMToken: 18.75, cacheReadPerMToken: 1.50 }],
  // Sonnet 4 family
  ['claude-sonnet-4-0', { inputPerMToken: 3, outputPerMToken: 15, cacheWritePerMToken: 3.75, cacheReadPerMToken: 0.30 }],
  ['claude-sonnet-4-5', { inputPerMToken: 3, outputPerMToken: 15, cacheWritePerMToken: 3.75, cacheReadPerMToken: 0.30 }],
  ['claude-sonnet-4-6', { inputPerMToken: 3, outputPerMToken: 15, cacheWritePerMToken: 3.75, cacheReadPerMToken: 0.30 }],
  // Sonnet 3.5 (legacy)
  ['claude-3-5-sonnet', { inputPerMToken: 3, outputPerMToken: 15, cacheWritePerMToken: 3.75, cacheReadPerMToken: 0.30 }],
  // Haiku 3.5
  ['claude-3-5-haiku', { inputPerMToken: 0.80, outputPerMToken: 4, cacheWritePerMToken: 1.00, cacheReadPerMToken: 0.08 }],
  // Haiku 4.5
  ['claude-haiku-4-5', { inputPerMToken: 0.80, outputPerMToken: 4, cacheWritePerMToken: 1.00, cacheReadPerMToken: 0.08 }],
]);

/**
 * Normalize a model ID to a canonical lookup key.
 * Strips Bedrock prefixes, date suffixes, version suffixes, and lowercases.
 */
export function normalizeModelId(rawId: string): string {
  let id = rawId.toLowerCase();

  // Strip Bedrock prefix: "anthropic.claude-..." → "claude-..."
  const bedrockPrefix = 'anthropic.';
  if (id.startsWith(bedrockPrefix)) {
    id = id.slice(bedrockPrefix.length);
  }

  // Strip trailing version suffix: "-v1:0", "-v2:0", etc.
  id = id.replace(/-v\d+:\d+$/, '');

  // Strip trailing date suffix: "-20250514", etc.
  id = id.replace(/-\d{8}$/, '');

  return id;
}

export function getModelPricing(modelId: string | undefined): ModelPricing | null {
  if (!modelId) return null;

  const normalized = normalizeModelId(modelId);

  // Exact match
  const exact = PRICING_TABLE.get(normalized);
  if (exact) return exact;

  // Prefix match: find the longest matching key
  let bestMatch: ModelPricing | null = null;
  let bestLength = 0;
  for (const [key, pricing] of PRICING_TABLE) {
    if (normalized.startsWith(key) && key.length > bestLength) {
      bestMatch = pricing;
      bestLength = key.length;
    }
  }

  return bestMatch;
}

export function calculateCost(tokens: TokenCounts, pricing: ModelPricing): number {
  return (
    (tokens.inputTokens * pricing.inputPerMToken) / 1_000_000 +
    (tokens.outputTokens * pricing.outputPerMToken) / 1_000_000 +
    (tokens.cacheWriteTokens * pricing.cacheWritePerMToken) / 1_000_000 +
    (tokens.cacheReadTokens * pricing.cacheReadPerMToken) / 1_000_000
  );
}

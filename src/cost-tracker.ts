import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { StdinData, CostData } from './types.js';
import { getHudPluginDir } from './claude-config-dir.js';
import { getModelPricing, calculateCost } from './pricing.js';

interface CostCache {
  accumulatedInput: number;
  accumulatedOutput: number;
  accumulatedCacheWrite: number;
  accumulatedCacheRead: number;
  lastSeenInput: number;
  lastSeenOutput: number;
  lastSeenCacheWrite: number;
  lastSeenCacheRead: number;
  transcriptPath: string;
  timestamp: number;
}

export type CostTrackerDeps = {
  homeDir: () => string;
  now: () => number;
};

const defaultDeps: CostTrackerDeps = {
  homeDir: () => os.homedir(),
  now: () => Date.now(),
};

function getCachePath(homeDir: string): string {
  return path.join(getHudPluginDir(homeDir), '.cost-cache.json');
}

function readCache(homeDir: string): CostCache | null {
  try {
    const cachePath = getCachePath(homeDir);
    if (!fs.existsSync(cachePath)) return null;
    const content = fs.readFileSync(cachePath, 'utf8');
    const parsed = JSON.parse(content) as CostCache;
    if (typeof parsed.transcriptPath !== 'string' || typeof parsed.timestamp !== 'number') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(homeDir: string, cache: CostCache): void {
  try {
    const cachePath = getCachePath(homeDir);
    const cacheDir = path.dirname(cachePath);
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    fs.writeFileSync(cachePath, JSON.stringify(cache), 'utf8');
  } catch {
    // Ignore cache write failures
  }
}

export function trackCost(stdin: StdinData, overrides: Partial<CostTrackerDeps> = {}): CostData {
  const deps = { ...defaultDeps, ...overrides };
  const homeDir = deps.homeDir();
  const now = deps.now();

  const usage = stdin.context_window?.current_usage;
  const currentInput = usage?.input_tokens ?? 0;
  const currentOutput = usage?.output_tokens ?? 0;
  const currentCacheWrite = usage?.cache_creation_input_tokens ?? 0;
  const currentCacheRead = usage?.cache_read_input_tokens ?? 0;
  const transcriptPath = stdin.transcript_path ?? '';

  const previous = readCache(homeDir);

  let accInput = 0;
  let accOutput = 0;
  let accCacheWrite = 0;
  let accCacheRead = 0;

  if (previous && previous.transcriptPath === transcriptPath) {
    accInput = previous.accumulatedInput;
    accOutput = previous.accumulatedOutput;
    accCacheWrite = previous.accumulatedCacheWrite;
    accCacheRead = previous.accumulatedCacheRead;

    // Detect compaction: current tokens dropped below last seen
    if (currentInput < previous.lastSeenInput) {
      accInput += previous.lastSeenInput;
      accOutput += previous.lastSeenOutput;
      accCacheWrite += previous.lastSeenCacheWrite;
      accCacheRead += previous.lastSeenCacheRead;
    }
  }
  // If transcriptPath changed, accumulators stay at 0 (new session)

  const cache: CostCache = {
    accumulatedInput: accInput,
    accumulatedOutput: accOutput,
    accumulatedCacheWrite: accCacheWrite,
    accumulatedCacheRead: accCacheRead,
    lastSeenInput: currentInput,
    lastSeenOutput: currentOutput,
    lastSeenCacheWrite: currentCacheWrite,
    lastSeenCacheRead: currentCacheRead,
    transcriptPath,
    timestamp: now,
  };

  writeCache(homeDir, cache);

  const totalInput = accInput + currentInput;
  const totalOutput = accOutput + currentOutput;
  const totalCacheWrite = accCacheWrite + currentCacheWrite;
  const totalCacheRead = accCacheRead + currentCacheRead;

  const pricing = getModelPricing(stdin.model?.id);
  const totalCost = pricing
    ? calculateCost({
        inputTokens: totalInput,
        outputTokens: totalOutput,
        cacheWriteTokens: totalCacheWrite,
        cacheReadTokens: totalCacheRead,
      }, pricing)
    : null;

  return {
    totalInput,
    totalOutput,
    totalCacheWrite,
    totalCacheRead,
    totalCost,
  };
}

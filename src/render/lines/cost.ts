import type { RenderContext } from '../../types.js';
import { label, getCostColor, RESET } from '../colors.js';

export function renderCostLine(ctx: RenderContext): string | null {
  const display = ctx.config?.display;
  const colors = ctx.config?.colors;

  if (display?.showCost !== true) {
    return null;
  }

  if (!ctx.costData) {
    return null;
  }

  const { totalInput, totalOutput, totalCost } = ctx.costData;
  const costLabel = label('Cost', colors);
  const tokenPart = `${formatTokens(totalInput)} in / ${formatTokens(totalOutput)} out`;

  if (totalCost === null) {
    return `${costLabel} ??? | ${label(tokenPart, colors)}`;
  }

  const costColor = getCostColor(totalCost, colors);
  const costDisplay = `${costColor}${formatCost(totalCost)}${RESET}`;

  const parts = [costDisplay, label(tokenPart, colors)];

  // Hourly rate from session duration
  const hourlyRate = getHourlyRate(totalCost, ctx.sessionDuration);
  if (hourlyRate !== null) {
    parts.push(label(`${formatCost(hourlyRate)}/hr`, colors));
  }

  return `${costLabel} ${parts.join(label(' | ', colors))}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(0)}k`;
  }
  return n.toString();
}

function formatCost(dollars: number): string {
  if (dollars < 0.01 && dollars > 0) {
    return '<$0.01';
  }
  return `$${dollars.toFixed(2)}`;
}

function getHourlyRate(totalCost: number, sessionDuration: string): number | null {
  if (totalCost <= 0 || !sessionDuration) return null;

  const hours = parseDurationToHours(sessionDuration);
  if (hours === null || hours < 1 / 60) return null; // need at least 1 minute

  return totalCost / hours;
}

function parseDurationToHours(duration: string): number | null {
  // Formats: "<1m", "5m", "1h 30m"
  const hourMatch = duration.match(/(\d+)h/);
  const minMatch = duration.match(/(\d+)m/);

  const hours = hourMatch ? parseInt(hourMatch[1], 10) : 0;
  const mins = minMatch ? parseInt(minMatch[1], 10) : 0;

  if (hours === 0 && mins === 0) return null;
  return hours + mins / 60;
}

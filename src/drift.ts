import type { GoldenBaseline, DriftVerdict, DriftReport } from "./types.js";

export function tokenSimilarity(a: string, b: string): number {
  const tokensA = significantTokens(a);
  const tokensB = significantTokens(b);

  if (tokensA.size === 0 && tokensB.size === 0) return 1.0;
  if (tokensA.size === 0 || tokensB.size === 0) return 0.0;

  const intersection = [...tokensA].filter(t => tokensB.has(t)).length;
  const union = new Set([...tokensA, ...tokensB]).size;
  return intersection / union;
}

export function lengthRatio(actual: string, expected: string): number {
  if (expected.length === 0) return actual.length === 0 ? 1.0 : 0.0;
  return Math.min(actual.length, expected.length) / Math.max(actual.length, expected.length);
}

export function checkEntry(
  input: Record<string, string>,
  expectedOutput: string,
  actualOutput: string,
  threshold: number = 0.7,
): DriftVerdict {
  const similarity = tokenSimilarity(actualOutput, expectedOutput);
  const lenRatio = lengthRatio(actualOutput, expectedOutput);
  const drifted = similarity < threshold;

  let reason: string;
  if (!drifted) {
    reason = "stable";
  } else if (similarity < 0.3) {
    reason = "severe drift";
  } else if (lenRatio < 0.3) {
    reason = `length mismatch (ratio=${lenRatio.toFixed(2)})`;
  } else {
    reason = `similarity ${similarity.toFixed(2)} below threshold ${threshold}`;
  }

  return {
    input,
    expected: expectedOutput,
    actual: actualOutput,
    similarity: Math.round(similarity * 1e4) / 1e4,
    lengthRatio: Math.round(lenRatio * 1e4) / 1e4,
    drifted,
    reason,
  };
}

export async function checkBaseline(
  baseline: GoldenBaseline,
  runner: (prompt: string, input: Record<string, string>) => Promise<string>,
  threshold: number = 0.7,
): Promise<DriftReport> {
  const entries: DriftVerdict[] = [];

  for (const e of baseline.entries) {
    const rendered = renderTemplate(baseline.promptTemplate, e.input);
    const actual = await runner(rendered, e.input);
    entries.push(checkEntry(e.input, e.expectedOutput, actual, threshold));
  }

  const drifted = entries.filter(e => e.drifted).length;
  const driftRate = entries.length > 0 ? drifted / entries.length : 0;

  return {
    total: entries.length,
    drifted,
    driftRate: Math.round(driftRate * 1e4) / 1e4,
    entries,
    passed: driftRate === 0,
    summary: entries.length === 0
      ? "No baseline entries to check"
      : driftRate === 0
        ? `All ${entries.length} entries stable`
        : `${drifted}/${entries.length} entries drifted (${(driftRate * 100).toFixed(1)}%)`,
  };
}

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    return vars[key] ?? `{{${key}}}`;
  });
}

function significantTokens(text: string): Set<string> {
  const stopwords = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "can", "shall", "to", "of", "in", "for",
    "on", "with", "at", "by", "from", "as", "into", "through", "during",
    "before", "after", "above", "below", "between", "and", "but", "or",
    "not", "no", "if", "then", "than", "that", "this", "these", "those",
    "it", "its", "they", "them", "their", "we", "our", "you", "your",
    "he", "she", "his", "her", "very", "just", "also", "about", "so",
  ]);

  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/);
  return new Set(words.filter(w => w.length > 2 && !stopwords.has(w)));
}

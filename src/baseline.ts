import type { GoldenBaseline, BaselineEntry } from "./types.js";

export function createBaseline(promptTemplate: string, name?: string): GoldenBaseline {
  return {
    version: 1,
    promptTemplate,
    entries: [],
    meta: {
      name,
      createdAt: new Date().toISOString(),
    },
  };
}

export function setEntry(
  baseline: GoldenBaseline,
  input: Record<string, string>,
  expectedOutput: string,
  notes?: string,
): void {
  const key = entryKey(input);
  const existing = baseline.entries.findIndex(e => entryKey(e.input) === key);
  const meta = {
    lockedAt: new Date().toISOString(),
    notes,
  };

  if (existing >= 0) {
    baseline.entries[existing] = { input, expectedOutput, meta };
  } else {
    baseline.entries.push({ input, expectedOutput, meta });
  }
}

export function removeEntry(baseline: GoldenBaseline, input: Record<string, string>): boolean {
  const key = entryKey(input);
  const idx = baseline.entries.findIndex(e => entryKey(e.input) === key);
  if (idx >= 0) {
    baseline.entries.splice(idx, 1);
    return true;
  }
  return false;
}

export function getEntry(baseline: GoldenBaseline, input: Record<string, string>): BaselineEntry | undefined {
  const key = entryKey(input);
  return baseline.entries.find(e => entryKey(e.input) === key);
}

export function validateBaseline(data: unknown): GoldenBaseline {
  if (!data || typeof data !== "object") throw new Error("Baseline must be an object");
  const b = data as Record<string, unknown>;
  if (b.version !== 1) throw new Error(`Unsupported baseline version: ${b.version}`);
  if (typeof b.promptTemplate !== "string") throw new Error("Missing promptTemplate");
  if (!Array.isArray(b.entries)) throw new Error("Missing entries array");
  for (const e of b.entries) {
    if (!e.input || typeof e.input !== "object") throw new Error("Entry missing input");
    if (typeof e.expectedOutput !== "string") throw new Error("Entry missing expectedOutput");
  }
  return data as GoldenBaseline;
}

export function serializeBaseline(baseline: GoldenBaseline): string {
  return JSON.stringify(baseline, null, 2);
}

function entryKey(input: Record<string, string>): string {
  return Object.keys(input).sort().map(k => `${k}=${input[k]}`).join("|");
}

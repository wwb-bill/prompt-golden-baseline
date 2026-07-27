export interface BaselineEntry {
  input: Record<string, string>;
  expectedOutput: string;
  meta?: {
    lockedAt?: string;
    lockedBy?: string;
    notes?: string;
  };
}

export interface GoldenBaseline {
  version: 1;
  promptTemplate: string;
  entries: BaselineEntry[];
  meta?: {
    name?: string;
    description?: string;
    createdAt?: string;
  };
}

export interface DriftVerdict {
  input: Record<string, string>;
  expected: string;
  actual: string;
  similarity: number;
  lengthRatio: number;
  drifted: boolean;
  reason: string;
}

export interface DriftReport {
  total: number;
  drifted: number;
  driftRate: number;
  entries: DriftVerdict[];
  passed: boolean;
  summary: string;
}

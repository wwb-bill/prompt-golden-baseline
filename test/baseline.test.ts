import { describe, it, expect } from "vitest";
import { createBaseline, setEntry, removeEntry, getEntry, validateBaseline, serializeBaseline } from "../src/baseline.js";
import { tokenSimilarity, lengthRatio, checkEntry, checkBaseline, renderTemplate } from "../src/drift.js";
import type { GoldenBaseline } from "../src/types.js";

describe("createBaseline", () => {
  it("creates an empty baseline", () => {
    const b = createBaseline("Hello {{name}}", "test");
    expect(b.version).toBe(1);
    expect(b.promptTemplate).toBe("Hello {{name}}");
    expect(b.entries).toHaveLength(0);
    expect(b.meta?.name).toBe("test");
  });
});

describe("setEntry / getEntry / removeEntry", () => {
  it("adds and retrieves entries", () => {
    const b = createBaseline("{{greeting}} {{name}}");
    setEntry(b, { greeting: "Hello", name: "World" }, "Hello World output");
    expect(b.entries).toHaveLength(1);
    const e = getEntry(b, { name: "World", greeting: "Hello" });
    expect(e?.expectedOutput).toBe("Hello World output");
  });

  it("updates existing entry", () => {
    const b = createBaseline("{{x}}");
    setEntry(b, { x: "a" }, "first");
    setEntry(b, { x: "a" }, "second");
    expect(b.entries).toHaveLength(1);
    expect(b.entries[0].expectedOutput).toBe("second");
  });

  it("removes entry", () => {
    const b = createBaseline("{{x}}");
    setEntry(b, { x: "a" }, "out");
    expect(removeEntry(b, { x: "a" })).toBe(true);
    expect(b.entries).toHaveLength(0);
    expect(removeEntry(b, { x: "nonexistent" })).toBe(false);
  });

  it("stores lock metadata", () => {
    const b = createBaseline("{{q}}");
    setEntry(b, { q: "test" }, "output", "added for testing");
    expect(b.entries[0].meta?.notes).toBe("added for testing");
  });
});

describe("validateBaseline", () => {
  it("accepts valid baseline", () => {
    const b = createBaseline("{{x}}");
    setEntry(b, { x: "a" }, "out");
    expect(() => validateBaseline(JSON.parse(serializeBaseline(b)))).not.toThrow();
  });

  it("rejects non-object", () => {
    expect(() => validateBaseline(null)).toThrow();
  });

  it("rejects wrong version", () => {
    expect(() => validateBaseline({ version: 99 })).toThrow("version");
  });

  it("rejects missing entries", () => {
    expect(() => validateBaseline({ version: 1, promptTemplate: "x" })).toThrow("entries");
  });

  it("rejects entry without expectedOutput", () => {
    expect(() => validateBaseline({ version: 1, promptTemplate: "x", entries: [{ input: { x: "a" } }] })).toThrow("expectedOutput");
  });
});

describe("serializeBaseline", () => {
  it("produces parseable JSON", () => {
    const b = createBaseline("{{x}}");
    setEntry(b, { x: "a" }, "out");
    const json = serializeBaseline(b);
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(1);
  });
});

describe("tokenSimilarity", () => {
  it("returns 1.0 for identical strings", () => {
    expect(tokenSimilarity("hello world", "hello world")).toBeCloseTo(1.0);
  });

  it("returns low score for different strings", () => {
    expect(tokenSimilarity("hello world", "goodbye universe")).toBeLessThan(0.5);
  });

  it("handles empty strings", () => {
    expect(tokenSimilarity("", "")).toBe(1.0);
    expect(tokenSimilarity("hello", "")).toBe(0.0);
  });

  it("ignores stopwords", () => {
    const sim = tokenSimilarity("the cat is sleeping", "the dog is running");
    expect(sim).toBe(0.0);
  });
});

describe("lengthRatio", () => {
  it("returns 1.0 for equal lengths", () => {
    expect(lengthRatio("hello", "world")).toBe(1.0);
  });

  it("returns ratio for different lengths", () => {
    const ratio = lengthRatio("hi", "hello world");
    expect(ratio).toBe(2 / 11);
  });
});

describe("checkEntry", () => {
  it("reports stable for identical output", () => {
    const v = checkEntry({ x: "a" }, "hello world", "hello world");
    expect(v.drifted).toBe(false);
    expect(v.similarity).toBeCloseTo(1.0);
  });

  it("reports drift for different output", () => {
    const v = checkEntry({ x: "a" }, "hello world", "goodbye universe");
    expect(v.drifted).toBe(true);
  });

  it("respects custom threshold", () => {
    const v = checkEntry({ x: "a" }, "hello world testing", "hello world something", 0.9);
    expect(v.drifted).toBe(true);
  });
});

describe("renderTemplate", () => {
  it("replaces variables", () => {
    expect(renderTemplate("Hello {{name}}", { name: "World" })).toBe("Hello World");
  });

  it("leaves unknown variables", () => {
    expect(renderTemplate("Hello {{name}}", {})).toBe("Hello {{name}}");
  });

  it("replaces multiple variables", () => {
    expect(renderTemplate("{{greeting}} {{name}}!", { greeting: "Hi", name: "Sam" })).toBe("Hi Sam!");
  });
});

describe("checkBaseline", () => {
  function makeRunner(responses: Map<string, string>) {
    return async (_prompt: string, input: Record<string, string>) => {
      const key = Object.keys(input).sort().map(k => `${k}=${input[k]}`).join("|");
      return responses.get(key) ?? "[missing]";
    };
  }

  it("passes when all outputs match", async () => {
    const b = createBaseline("{{x}} {{y}}");
    setEntry(b, { x: "a", y: "b" }, "alpha bravo matched");
    setEntry(b, { x: "c", y: "d" }, "charlie delta matched");
    const runner = makeRunner(new Map([["x=a|y=b", "alpha bravo matched"], ["x=c|y=d", "charlie delta matched"]]));
    const report = await checkBaseline(b, runner);
    expect(report.passed).toBe(true);
    expect(report.drifted).toBe(0);
  });

  it("detects drift when output changes", async () => {
    const b = createBaseline("{{q}}");
    setEntry(b, { q: "test" }, "expected golden output here");
    const runner = makeRunner(new Map([["q=test", "completely different actual output today"]]));
    const report = await checkBaseline(b, runner);
    expect(report.passed).toBe(false);
    expect(report.drifted).toBe(1);
  });

  it("handles empty baseline", async () => {
    const b = createBaseline("{{x}}");
    const report = await checkBaseline(b, async () => "anything");
    expect(report.total).toBe(0);
    expect(report.passed).toBe(true);
  });

  it("reports summary for mixed results", async () => {
    const b = createBaseline("{{q}}");
    setEntry(b, { q: "a" }, "expected output alpha");
    setEntry(b, { q: "b" }, "expected output bravo");
    const runner = makeRunner(new Map([["q=a", "expected output alpha"], ["q=b", "totally different from bravo"]]));
    const report = await checkBaseline(b, runner);
    expect(report.drifted).toBe(1);
    expect(report.driftRate).toBe(0.5);
  });
});

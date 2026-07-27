#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { createBaseline, setEntry, validateBaseline, serializeBaseline } from "./baseline.js";
import { checkBaseline, renderTemplate } from "./drift.js";
import type { GoldenBaseline } from "./types.js";

function help(): void {
  console.log(`prompt-golden-baseline

Usage:
  prompt-golden-baseline init <template-file> [--name <name>]
  prompt-golden-baseline lock <baseline.json> <input.json> <expected.txt>
  prompt-golden-baseline check <baseline.json> [--threshold 0.7] [--json] [--fail-on-drift]
  prompt-golden-baseline run <baseline.json> [--dry] [--threshold 0.7] [--json]
`);
}

async function main(argv: string[]): Promise<void> {
  const args = argv.slice(2);
  const cmd = args[0];

  if (!cmd || cmd === "--help" || cmd === "-h") {
    help();
    return;
  }

  const threshold = parseFloat(flagVal(args, "--threshold") ?? "0.7");
  const useJson = args.includes("--json");
  const failOnDrift = args.includes("--fail-on-drift");
  const dry = args.includes("--dry");

  try {
    switch (cmd) {
      case "init": {
        const templateFile = args[1];
        if (!templateFile) { console.error("Missing template file"); process.exit(1); }
        const name = flagVal(args, "--name");
        const template = readFileSync(templateFile, "utf-8").trim();
        const baseline = createBaseline(template, name ?? undefined);
        const path = `${name ?? "baseline"}.golden.json`;
        writeFileSync(path, serializeBaseline(baseline), "utf-8");
        console.log(`Created ${path}`);
        break;
      }
      case "lock": {
        const baselineFile = args[1];
        const inputFile = args[2];
        const expectedFile = args[3];
        if (!baselineFile || !inputFile || !expectedFile) {
          console.error("Usage: prompt-golden-baseline lock <baseline.json> <input.json> <expected.txt>");
          process.exit(1);
        }
        const baseline = loadBaseline(baselineFile);
        const input = JSON.parse(readFileSync(inputFile, "utf-8"));
        const expected = readFileSync(expectedFile, "utf-8").trim();
        setEntry(baseline, input, expected);
        writeFileSync(baselineFile, serializeBaseline(baseline), "utf-8");
        console.log(`Locked entry. Baseline now has ${baseline.entries.length} entries`);
        break;
      }
      case "check": {
        const baselineFile = args[1];
        if (!baselineFile) { console.error("Missing baseline file"); process.exit(1); }
        const baseline = loadBaseline(baselineFile);
        const report = await checkBaseline(baseline, async (_prompt, input) => {
          return `[echo] ${renderTemplate(baseline.promptTemplate, input)}`;
        }, threshold);

        if (useJson) {
          console.log(JSON.stringify(report, null, 2));
        } else {
          console.log(report.summary);
          for (const e of report.entries) {
            if (e.drifted) {
              console.log(`  DRIFT: ${JSON.stringify(e.input)} — sim=${e.similarity}`);
            }
          }
          if (report.passed) console.log("All entries stable");
        }
        if (failOnDrift && !report.passed) process.exit(1);
        break;
      }
      case "run": {
        const baselineFile = args[1];
        if (!baselineFile) { console.error("Missing baseline file"); process.exit(1); }
        const baseline = loadBaseline(baselineFile);
        const stdin = readFileSync(0, "utf-8");
        const lines = stdin.trim().split("\n").filter(l => l.trim());
        const outputs = new Map<string, string>();
        for (const line of lines) {
          const obj = JSON.parse(line);
          const key = Object.keys(obj.input).sort().map(k => `${k}=${obj.input[k]}`).join("|");
          outputs.set(key, obj.output);
        }
        const report = await checkBaseline(baseline, async (_prompt, input) => {
          const key = Object.keys(input).sort().map(k => `${k}=${input[k]}`).join("|");
          return outputs.get(key) ?? "[no output]";
        }, threshold);
        if (useJson) console.log(JSON.stringify(report, null, 2));
        else console.log(report.summary);
        if (failOnDrift && !report.passed) process.exit(1);
        break;
      }
      default:
        console.error(`Unknown command: ${cmd}`);
        help();
        process.exit(1);
    }
  } catch (err) {
    console.error("Error:", (err as Error).message);
    process.exit(1);
  }
}

function loadBaseline(path: string): GoldenBaseline {
  return validateBaseline(JSON.parse(readFileSync(path, "utf-8")));
}

function flagVal(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx >= 0 && idx + 1 < args.length) return args[idx + 1];
  return undefined;
}

main(process.argv);

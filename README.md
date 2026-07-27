# prompt-golden-baseline

Anchor prompts against golden baseline outputs — detect drift from curated references, not just previous versions.

[![CI](https://github.com/wwb-bill/prompt-golden-baseline/actions/workflows/ci.yml/badge.svg)](https://github.com/wwb-bill/prompt-golden-baseline/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

## Why Golden Baselines?

Existing drift tools compare prompt version N against version N-1 — they catch *change*, not *degradation*. Golden baselines flip this: you curate a set of reference input→output pairs that represent **correct behavior**, and the tool alerts you when prompt changes break any of them.

## Install

```bash
npm install -g prompt-golden-baseline
```

## Quick Start

```bash
# Create a prompt template
echo 'Translate "{{word}}" to {{language}}.' > template.txt

# Initialize a golden baseline
prompt-golden-baseline init template.txt --name translations

# Lock golden entries
echo '{"word":"hello","language":"Spanish"}' > input.json
echo 'Traduce "hello" al espanol: hola' > expected.txt
prompt-golden-baseline lock translations.golden.json input.json expected.txt

# Check if your prompt still produces correct outputs
prompt-golden-baseline check translations.golden.json --fail-on-drift
```

## CLI Commands

- `init` — Create a new empty baseline from a prompt template
- `lock` — Add or update a golden baseline entry
- `check` — Verify all entries against the baseline
- `run` — Check baseline with real model outputs via stdin

## License

MIT

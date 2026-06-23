# DevEx Framework — Product Steering

## Purpose

The DevEx Framework is a shared platform that enforces engineering consistency across 10+ independent teams. It reduces the cost of compliance and improves DORA metrics by making the "right way" the easiest way.

## Core Value Proposition

- **Convention over Configuration**: teams get a working CI pipeline, branch governance, and DORA metrics out of the box with `devex init`.
- **Shift-Left**: defects are caught locally (pre-push hook) before they reach CI, and at synth time before they reach AWS.
- **Polyglot support**: the CLI works for any language team (Python, Go, Clojure, TypeScript) because it reads git history and project structure rather than language-specific files.

## Target Users

1. **Application Engineers** — use the `devex` CLI daily: `devex branch create`, `devex standards check`
2. **Platform Engineers** — extend the TypeScript framework with new CDK constructs and pipeline stages
3. **Engineering Managers** — consume `devex dora report` output to track team-level DORA performance

## Non-Goals

- The framework does not replace team-owned infrastructure — it provides a base class (`GoldenPathStack`) that teams extend
- The CLI does not enforce work item management system choice — Work ID format (`[A-Z]+-\d+`) is tracker-agnostic
- The framework does not manage secrets or AWS account vending

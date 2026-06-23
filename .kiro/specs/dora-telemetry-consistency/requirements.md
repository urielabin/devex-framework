# Requirements: DORA Telemetry Consistency

## Problem

DORA metrics are only useful to a platform team if they are comparable across teams. A
Python team's deployment frequency must mean the same thing, in the same CloudWatch
namespace, with the same dimensions, as a TypeScript or Go team's.

## User Stories

### 1. Cross-team comparability

**As** a platform engineer building an org-wide DORA dashboard,
**I want** every team's metrics emitted to the same CloudWatch namespace with the same
dimension names,
**so that** I can compare any two teams side by side without per-team normalisation logic.

**Acceptance criteria (EARS):**
- WHEN any tool (Python CLI or TypeScript framework) emits a DORA metric, THE SYSTEM SHALL
  write to the `DevEx/DORA` namespace.
- WHEN a metric is emitted, THE SYSTEM SHALL attach `TeamName` and `WorkIdPrefix` dimensions
  with identical dimension names regardless of which tool emitted the metric.
- IF a team has not configured a Work ID prefix (no `.devex.yml`), THEN THE SYSTEM SHALL
  refuse to emit and SHALL explain why, rather than emitting an undimensioned metric that
  would be indistinguishable from every other team's.

### 2. No silent misconfiguration

**As** a team adopting the Golden Path for the first time,
**I want** a clear error if I try to emit metrics before running `devex init`,
**so that** I don't silently pollute the shared namespace with unattributable data.

**Acceptance criteria (EARS):**
- WHEN `devex dora report --emit-cloudwatch` runs without a `.devex.yml` present, THE SYSTEM
  SHALL exit with a non-zero status and a message naming the missing file and the
  consequence (metrics would not be attributable to a team).

## Out of scope

- A `team_name` field distinct from `work_id_prefix`. Today, `work_id_prefix` already serves
  as the de facto team identifier throughout the CLI (branch names, commit messages, config).
  Introducing a second identifier would be configuration without a corresponding convention
  benefit — see `.kiro/steering/tech.md`.

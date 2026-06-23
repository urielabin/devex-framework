# Changelog

All notable changes to the DevEx Framework are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added

#### Python CLI (`devex`)
- `devex init` — bootstraps a project with `.devex.yml`, PR template, and pre-push git hook
- `devex standards check` — validates branch name, commit message, PR template, config, and test presence; exits 1 on any failure for CI integration
- `devex branch create <work-id> <description>` — creates a compliant `feat/WORK-123-slug` branch
- `devex dora report` — computes Deployment Frequency, Lead Time, CFR, MTTR from git history; optional CloudWatch emission
- Pre-push hook installs language-aware lint + test gates (ruff/mypy/pytest for Python; ESLint/jest for Node)
- Property-Based Tests (hypothesis) for all validators
- SOC 2 audit trail at `~/.devex/audit.jsonl`

#### TypeScript Framework (`@devex/workflow-framework`)
- `generatePRPipeline()` — typed GitHub Actions PR pipeline with convention validation, PBT, CDK synth
- `generateIntegrationPipeline()` — main-branch pipeline with staging → smoke tests → production gate
- `GoldenPathStack` — CDK base stack enforcing WorkId context and mandatory finops tags at synth time
- `LambdaService` — L3 CDK construct: Lambda (Python 3.11) + DynamoDB + CloudWatch alarms
- `createDoraAlarm()` / `emitLeadTimeMetric()` — CloudWatch DORA metrics with `TeamName` + `WorkIdPrefix` dimensions for cross-team comparability

#### Platform
- Documented Amazon Q Developer GitHub App as the AI PR review layer (opt-in install, no custom workflow required)
- AWS Kiro steering files (`.kiro/steering/`) for AI-assisted compliant code generation
- Docker Compose local environment (DynamoDB Local + Admin UI)
- Language support matrix: Python, TypeScript/CDK, Go (community)

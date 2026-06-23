# Contributing to DevEx Framework

Thank you for contributing to the DevEx Platform. This guide explains how to set up your development environment and submit changes.

## Prerequisites

- Python 3.11+ and [uv](https://docs.astral.sh/uv/) for the CLI
- Node.js 20+ and [pnpm](https://pnpm.io/) for the TypeScript framework
- Git

## Getting Started

```bash
git clone https://github.com/urielabin/devex-framework
cd devex-framework
```

### Python CLI

```bash
cd tools/devex-cli
export UV_NO_EDITABLE=1     # macOS only — see README's local development setup note
uv sync --all-extras        # install all dependencies
uv run devex --help         # verify the CLI works
uv run pytest tests/ -v     # run tests
```

### TypeScript Framework

```bash
cd packages/workflow-framework
pnpm install
pnpm test
pnpm build
```

## Work ID Convention

Every branch, commit, and PR **must** include a Work ID (e.g. `FIN-123`).

```bash
# Create a compliant branch
devex branch create FIN-123 "your feature description"

# Check your repo before pushing
devex standards check
```

## Submitting Changes

1. Create a branch: `devex branch create <WORK-ID> <description>`
2. Make your changes and write tests
3. Run `devex standards check` — it must pass
4. Open a PR with the Work ID in the title: `[FIN-123] Your change`
5. Assign at least 2 reviewers

## Adding a New CLI Command

1. Create `tools/devex-cli/src/devex/commands/<name>.py` with a `typer.Typer()` app
2. Register it in `main.py`: `app.add_typer(<name>.app, name="<name>")`
3. Add tests in `tools/devex-cli/tests/test_<name>.py`

## Adding a New CDK Construct

1. Create `packages/workflow-framework/src/constructs/<name>.ts`
2. Export it from `src/index.ts`
3. Add tests in `packages/workflow-framework/test/<name>.test.ts`

## Adding New Language Support

The DevEx Framework is explicitly designed for polyglot teams. If your team works in Rust, Java, Clojure, or another language not yet listed in the README's language support table, you can extend the platform without waiting for the platform team. Go is already supported end-to-end (detection + pre-push gates) and is a good reference if you want to see both steps below applied for real.

### 1. Add a language detector to `devex init`

Edit `tools/devex-cli/src/devex/commands/init.py` — add your language's sentinel file to `_detect_project_type()`:

```python
# Before the fallback "unknown" return
if (project_root / "Cargo.toml").exists():
    return "rust"
if (project_root / "pom.xml").exists():
    return "java"
```

### 2. Add a pre-push lint/test block to the hook

Edit `tools/devex-cli/src/devex/hooks/installer.py` — add a language-specific block inside `PRE_PUSH_HOOK`:

```sh
# Rust
if [ -f Cargo.toml ] && command -v cargo >/dev/null 2>&1; then
    echo "[devex] Linting Rust (clippy + test)..."
    cargo clippy -- -D warnings
    cargo test
fi
```

### 3. Add a pipeline variant to the TypeScript framework (optional)

If your language needs a distinct CI pipeline shape (e.g. `mvn test` instead of `pytest`), add a `projectType` branch inside `generatePRPipeline()` in `packages/workflow-framework/src/workflows/pr-pipeline.ts`:

```typescript
if (options.projectType === "java") {
  testJob.addStep(new Step({ name: "Run tests", run: "mvn test -q" }));
}
```

### 4. Document it

Add a row to the language support table in `README.md` and open a PR following the standard flow.

### Checklist for new language support PRs

- [ ] `_detect_project_type()` updated with a new sentinel file
- [ ] Pre-push hook updated with lint + fast-test block
- [ ] At least one test covering the new validator or hook path
- [ ] README language table updated

## Code Review

All PRs require **2 reviewer approvals** before merge. This is enforced by branch protection rules and validated by `devex standards check` in CI.

## Questions

Open an issue or reach out on the internal `#devex-platform` Slack channel.

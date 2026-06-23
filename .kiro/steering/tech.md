# DevEx Framework — Technology Steering

## Python CLI

| Concern | Tool | Rationale |
|---------|------|-----------|
| CLI framework | `typer` | Type-safe, auto-generates help, Rich integration |
| Output formatting | `rich` | Tables, colour, progress without custom code |
| Git operations | `gitpython` | Typed Python API, avoids shell injection risk |
| Config files | `pyyaml` | Language-agnostic `.devex.yml` config |
| HTTP calls | `httpx` | Async-capable, type-safe, modern replacement for requests |
| AWS SDK | `boto3` | DORA CloudWatch emission |
| Package manager | `uv` | Fast, isolated, reproducible installs |
| Linting | `ruff` | Replaces flake8 + isort + pyupgrade in one tool |
| Type checking | `mypy --strict` | Catches type errors before runtime |
| Testing | `pytest` | Mature, plugin ecosystem |
| PBT | `hypothesis` | Property-Based Testing for validators |

### Do not use

- `click` (use `typer` instead — it wraps click with type safety)
- `requests` (use `httpx`)
- `subprocess` for git operations (use `gitpython`)
- `print()` for user output (use `console = Console()` from rich)

## TypeScript Framework

| Concern | Tool | Rationale |
|---------|------|-----------|
| Workflow generation | `@github-actions-workflow-ts/lib` | Compile-time type safety for GitHub Actions |
| IaC | `aws-cdk-lib` v2 | AWS standard, type-safe, L3 constructs reduce boilerplate |
| YAML serialisation | `js-yaml` | Stable, well-typed, used by `github-actions-workflow-ts` internally |
| Package manager | `pnpm` | Efficient disk usage, strict dependency resolution |
| Linting | `@typescript-eslint` | Catches type-unsafe patterns at lint time |
| Compiler | `tsc --strict` | Strict mode: no implicit any, strict null checks |
| Testing | `jest` + `ts-jest` | TypeScript-native test runner |

### Do not use

- `any` type — use `unknown` and narrow with type guards
- `require()` for static imports — use `import` (dynamic `import()` is acceptable for optional runtime deps)
- Inline YAML strings for workflow generation — use `github-actions-workflow-ts` constructs

## Infrastructure

| Concern | Tool |
|---------|------|
| Local DynamoDB | `amazon/dynamodb-local` (docker-compose) |
| Local DB admin | `aaronshaf/dynamodb-admin` |
| CloudWatch DORA | `DevEx/DORA` namespace, standard metric names |
| AWS Auth in CI | OIDC via `aws-actions/configure-aws-credentials@v4` (no long-lived keys) |

## Security Requirements

- All AWS credentials in CI use OIDC (`id-token: write` permission + role ARN) — no static access keys
- Secrets in `.env` files are gitignored; `.env.example` documents required variables
- `devex standards check` validates no credentials are in code (via ruff B checks)
- Amazon Q Developer (opt-in GitHub App, not installed by default) scans every PR for hardcoded secrets and IAM misconfigurations once enabled

# DevEx Framework — Repository Structure Steering

## Monorepo Layout

```
devex-framework/
├── tools/devex-cli/          Python CLI — uv-installable
│   ├── src/devex/
│   │   ├── commands/         One file per top-level command (init, standards, branch, dora)
│   │   ├── validators/       Pure functions: validate_work_id, validate_branch_name, validate_commit_message
│   │   ├── hooks/            Git hook management (installer only — no business logic)
│   │   └── dora/             DORA data collection (git log parsing)
│   └── tests/                pytest unit + PBT (hypothesis) tests
│
├── packages/workflow-framework/   TypeScript — pnpm-installable
│   ├── src/
│   │   ├── conventions.ts    Single source of truth for regex constants and shared types
│   │   ├── workflows/        Pipeline generators (pr-pipeline, integration-pipeline)
│   │   ├── constructs/       CDK L3 constructs (GoldenPathStack, LambdaService)
│   │   └── dora/             CloudWatch DORA metric emitters
│   └── test/                 Jest unit tests
│
├── .github/
│   ├── workflows/            CI, integration pipeline, and release for the platform repo itself
│   └── pull_request_template.md
│
├── .kiro/steering/           Spec-Driven Development context files (this directory)
├── docs/adr.md               Architecture Decision Record
├── docker-compose.yml        Local DynamoDB + admin UI
└── .env.example              Environment variable template
```

## Naming Conventions

| Layer | Convention | Example |
|-------|-----------|---------|
| Python commands | `snake_case` module, `app` Typer instance | `commands/standards.py` |
| Python validators | `validate_<entity>()` → `bool` | `validate_work_id("FIN-123")` |
| TypeScript constructs | `PascalCase` class | `GoldenPathStack`, `LambdaService` |
| TypeScript generators | `generate<Name>()` → `string` | `generatePRPipeline()` |
| CDK context variables | `PascalCase` | `WorkId`, `Environment` |
| Git branches | `<type>/<WORK-ID>-<desc>` | `feat/FIN-123-add-payment` |
| DORA CloudWatch namespace | `DevEx/DORA` | fixed — do not change |

## Adding a New Language to the Golden Path

1. Add detection in `tools/devex-cli/src/devex/commands/init.py` → `_detect_project_type()`
2. Add test runner step in `packages/workflow-framework/src/workflows/pr-pipeline.ts` → `small-tests` job
3. Document in `CONTRIBUTING.md` under "Adding new language support"
4. Add a PBT test in `tests/test_pbt_validators.py` for any new validator

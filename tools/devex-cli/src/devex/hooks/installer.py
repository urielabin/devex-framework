import stat
from pathlib import Path

PRE_PUSH_HOOK = """\
#!/bin/sh
# Installed by devex init -- Golden Path pre-push validation
# Runs convention checks, linting, and tests before every push.
set -e

echo "[devex] Running pre-push validation..."

# 1. Convention checks (branch name, commit message, PR template, config)
devex standards check --pre-push

# 2. Linting + type checking (language-aware)
if [ -f pyproject.toml ] && command -v uv >/dev/null 2>&1; then
    echo "[devex] Linting Python (ruff + mypy)..."
    uv run ruff check src/
    uv run mypy src/
fi

if [ -f package.json ] && command -v pnpm >/dev/null 2>&1; then
    if node -e "process.exit((require('./package.json').scripts || {}).lint ? 0 : 1)" 2>/dev/null; then
        echo "[devex] Linting TypeScript (eslint)..."
        pnpm lint
    else
        echo "[devex] No 'lint' script in package.json -- skipping."
    fi
fi

if [ -f go.mod ] && command -v go >/dev/null 2>&1; then
    echo "[devex] Linting Go (go vet)..."
    go vet ./...
fi

# 3. Fast unit tests (skip slow/integration tests)
if [ -f pyproject.toml ] && command -v uv >/dev/null 2>&1; then
    echo "[devex] Running Python unit tests..."
    uv run pytest tests/ -x -q --ignore=tests/integration 2>/dev/null || uv run pytest tests/ -x -q
fi

if [ -f package.json ] && command -v pnpm >/dev/null 2>&1; then
    if node -e "process.exit((require('./package.json').scripts || {}).test ? 0 : 1)" 2>/dev/null; then
        echo "[devex] Running TypeScript tests..."
        pnpm test --passWithNoTests
    else
        echo "[devex] No 'test' script in package.json -- skipping."
    fi
fi

if [ -f go.mod ] && command -v go >/dev/null 2>&1; then
    echo "[devex] Running Go tests..."
    go test ./... -short
fi

echo "[devex] Pre-push validation passed."
"""


def install_pre_push_hook(repo_root: Path) -> bool:
    """Install the pre-push git hook. Returns True if installed, False if already present."""
    hooks_dir = repo_root / ".git" / "hooks"
    if not hooks_dir.exists():
        return False

    hook_path = hooks_dir / "pre-push"
    if hook_path.exists():
        content = hook_path.read_text()
        if "devex standards check" in content:
            return False  # already installed

    hook_path.write_text(PRE_PUSH_HOOK)
    hook_path.chmod(hook_path.stat().st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)
    return True

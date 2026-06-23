import json
import os
from datetime import UTC, datetime
from pathlib import Path
from typing import Annotated

import git
import typer
from rich.console import Console
from rich.table import Table

from devex.validators.branch import validate_branch_name
from devex.validators.commit import validate_commit_message

console = Console()

app = typer.Typer(help="Check project standards and conventions.")


def _get_repo_info(path: Path) -> tuple[str | None, str | None, bool]:
    """Return (branch_name, last_commit_msg, is_git_repo)."""
    try:
        repo = git.Repo(path, search_parent_directories=True)
        branch: str = repo.active_branch.name
        raw_msg = repo.head.commit.message
        msg_str: str = raw_msg if isinstance(raw_msg, str) else raw_msg.decode()
        commit_msg: str = msg_str.strip().splitlines()[0]
        return branch, commit_msg, True
    except Exception:
        return None, None, False


def _write_audit_log(repo_path: Path, branch: str | None, results: dict[str, bool]) -> None:
    audit_dir = Path.home() / ".devex"
    audit_dir.mkdir(exist_ok=True)
    entry = {
        "timestamp": datetime.now(UTC).isoformat(),
        "command": "standards check",
        "repo": repo_path.name,
        "branch": branch,
        "checks": results,
        "user": os.environ.get("USER", "unknown"),
    }
    with open(audit_dir / "audit.jsonl", "a") as f:
        f.write(json.dumps(entry) + "\n")


@app.command("check")
def check(
    pre_push: Annotated[bool, typer.Option("--pre-push", help="Run in pre-push hook mode (minimal output)")] = False,
) -> None:
    """Validate the current repository against Golden Path conventions."""

    cwd = Path.cwd()
    branch, commit_msg, is_git = _get_repo_info(cwd)

    results: dict[str, tuple[bool, str]] = {}

    # Check 1: Branch name
    if branch:
        ok = validate_branch_name(branch)
        results["BRANCH_NAME"] = (ok, branch if ok else f"{branch} — expected feat/<ID>-desc")
    else:
        results["BRANCH_NAME"] = (False, "Not a git repository or detached HEAD")

    # Check 2: Work ID in last commit
    if commit_msg:
        ok = validate_commit_message(commit_msg)
        results["COMMIT_MSG"] = (ok, commit_msg[:60] if ok else f"No Work ID found in: {commit_msg[:50]}")
    else:
        results["COMMIT_MSG"] = (False, "No commits found")

    # Check 3: PR template
    pr_template = cwd / ".github" / "pull_request_template.md"
    # Also check parent dirs (common in mono-repos)
    for p in [cwd, *cwd.parents]:
        candidate = p / ".github" / "pull_request_template.md"
        if candidate.exists():
            pr_template = candidate
            break
    has_template = pr_template.exists()
    pr_detail = str(pr_template) if has_template else ".github/pull_request_template.md not found"
    results["PR_TEMPLATE"] = (has_template, pr_detail)

    # Check 4: .devex.yml present
    devex_cfg = cwd / ".devex.yml"
    for p in [cwd, *cwd.parents]:
        candidate = p / ".devex.yml"
        if candidate.exists():
            devex_cfg = candidate
            break
    has_cfg = devex_cfg.exists()
    results["DEVEX_CONFIG"] = (has_cfg, str(devex_cfg) if has_cfg else "Run 'devex init' to create .devex.yml")

    # Check 5: Tests present
    test_files = (
        list(cwd.rglob("test_*.py"))
        + list(cwd.rglob("*_test.py"))
        + list(cwd.rglob("*.test.ts"))
        + list(cwd.rglob("*.spec.ts"))
    )
    # Filter out node_modules and .venv
    test_files = [f for f in test_files if "node_modules" not in str(f) and ".venv" not in str(f)]
    has_tests = len(test_files) > 0
    results["TESTS_PRESENT"] = (
        has_tests,
        f"{len(test_files)} test file(s) found" if has_tests else "No test files found",
    )

    _write_audit_log(cwd, branch, {k: v[0] for k, v in results.items()})

    if pre_push:
        # Minimal output for git hooks
        failures = [k for k, (ok, _) in results.items() if not ok]
        if failures:
            console.print(f"[red]devex pre-push: failed checks: {', '.join(failures)}[/red]")
            raise typer.Exit(1)
        raise typer.Exit(0)

    table = Table(title="DevEx Standards Check", show_lines=True)
    table.add_column("Check", style="bold")
    table.add_column("Status", justify="center")
    table.add_column("Details")

    all_pass = True
    for check_name, (ok, detail) in results.items():
        status = "[green]✓[/green]" if ok else "[red]✗[/red]"
        table.add_row(check_name, status, detail)
        if not ok:
            all_pass = False

    console.print(table)

    if all_pass:
        console.print("\n[green]All checks passed.[/green]")
    else:
        console.print("\n[red]Some checks failed. See details above.[/red]")
        raise typer.Exit(1)

from pathlib import Path
from typing import Annotated

import typer
import yaml
from rich.console import Console
from rich.table import Table

from devex.hooks.installer import install_pre_push_hook

console = Console()

app = typer.Typer(help="Bootstrap a project to the Golden Path.")

PR_TEMPLATE = """\
## Summary

<!-- Briefly describe what this PR does and why -->

## Work ID

<!-- Required: Reference the Work ID for this change (e.g. FIN-123) -->
Work ID:

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactoring
- [ ] Documentation

## Checklist

- [ ] Tests added / updated
- [ ] `devex standards check` passes locally
- [ ] Two reviewers assigned
- [ ] PR title includes Work ID (e.g. `[FIN-123] Add payment endpoint`)
"""

DEVEX_CONFIG_TEMPLATE = {
    "work_id_prefix": "FIN",
    "two_reviewers": True,
    "pipeline_type": "pr-pipeline",
}


def _detect_project_type(path: Path) -> str:
    if (path / "cdk.json").exists():
        return "cdk"
    if (path / "pyproject.toml").exists() or (path / "setup.py").exists():
        return "python"
    if (path / "package.json").exists():
        return "node"
    if (path / "go.mod").exists():
        return "go"
    return "unknown"


@app.callback(invoke_without_command=True)
def init(
    ctx: typer.Context,
    path: Annotated[Path, typer.Option("--path", "-p", help="Project root (default: current dir)")] = Path("."),
    work_id_prefix: Annotated[str | None, typer.Option("--prefix", help="Work ID prefix (e.g. FIN, PLAT, PAY)")] = None,
) -> None:
    """Bootstrap a project to the Golden Path."""
    if ctx.invoked_subcommand is not None:
        return

    project_root = path.resolve()
    project_type = _detect_project_type(project_root)

    # Require an explicit prefix — a silent default would cause all teams to share
    # the same Work ID namespace, making DORA metrics and convention checks wrong.
    if work_id_prefix is None:
        work_id_prefix = (
            typer.prompt(
                "Work ID prefix for this team (e.g. FIN, PLAT, PAY)",
                default="",
            )
            .strip()
            .upper()
        )
        if not work_id_prefix:
            console.print("[red]Error:[/red] Work ID prefix is required (e.g. --prefix FIN).")
            raise typer.Exit(1)

    actions: list[tuple[str, str, str]] = []

    # Write .devex.yml
    devex_cfg_path = project_root / ".devex.yml"
    cfg = {**DEVEX_CONFIG_TEMPLATE, "work_id_prefix": work_id_prefix, "project_type": project_type}
    if not devex_cfg_path.exists():
        devex_cfg_path.write_text(yaml.dump(cfg, default_flow_style=False))
        actions.append((".devex.yml", "created", "Golden Path config"))
    else:
        actions.append((".devex.yml", "skipped", "Already exists"))

    # Write PR template
    github_dir = project_root / ".github"
    github_dir.mkdir(exist_ok=True)
    pr_template_path = github_dir / "pull_request_template.md"
    if not pr_template_path.exists():
        pr_template_path.write_text(PR_TEMPLATE)
        actions.append((".github/pull_request_template.md", "created", "PR template with Work ID section"))
    else:
        actions.append((".github/pull_request_template.md", "skipped", "Already exists"))

    # Install pre-push hook
    installed = install_pre_push_hook(project_root)
    if installed:
        actions.append((".git/hooks/pre-push", "created", "Runs conventions + lint + tests before push"))
    else:
        actions.append((".git/hooks/pre-push", "skipped", "Already installed or not a git repo"))

    # Display results
    console.print(f"\n[bold]DevEx Init[/bold] — project type detected: [cyan]{project_type}[/cyan]\n")
    table = Table(show_lines=True)
    table.add_column("File", style="bold")
    table.add_column("Status", justify="center")
    table.add_column("Notes")

    for file, status, note in actions:
        color = "green" if status == "created" else "yellow"
        table.add_row(file, f"[{color}]{status}[/{color}]", note)

    console.print(table)
    console.print("\n[green]Run 'devex standards check' to validate your repository.[/green]")

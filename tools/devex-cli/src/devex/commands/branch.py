import re
import subprocess
from typing import Annotated

import typer
from rich.console import Console

from devex.validators.work_id import validate_work_id

console = Console()

app = typer.Typer(help="Git branch workflow helpers.")

BranchType = typer.Option("feat", "--type", "-t", help="Branch type prefix")


def _slugify(text: str, max_len: int = 40) -> str:
    """Convert a description string to a dash-separated slug."""
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug[:max_len].rstrip("-")


@app.command("create")
def create(
    work_id: Annotated[str, typer.Argument(help="Work ID, e.g. FIN-123")],
    description: Annotated[str, typer.Argument(help="Short description of the work")],
    branch_type: Annotated[str, typer.Option("--type", "-t", help="Branch type: feat, fix, chore, refactor")] = "feat",
) -> None:
    """Create a Golden Path compliant git branch."""
    if branch_type not in ("feat", "fix", "chore", "refactor"):
        console.print(f"[red]Invalid branch type '{branch_type}'. Use: feat, fix, chore, refactor[/red]")
        raise typer.Exit(1)

    if not validate_work_id(work_id):
        console.print(f"[red]Invalid Work ID '{work_id}'. Expected format: UPPERCASE-NUMBER (e.g. FIN-123)[/red]")
        raise typer.Exit(1)

    slug = _slugify(description)
    branch_name = f"{branch_type}/{work_id}-{slug}"

    try:
        result = subprocess.run(
            ["git", "checkout", "-b", branch_name],
            capture_output=True,
            text=True,
            check=True,
        )
        console.print(f"[green]Created branch:[/green] {branch_name}")
        if result.stderr:
            console.print(f"[dim]{result.stderr.strip()}[/dim]")
    except subprocess.CalledProcessError as e:
        console.print(f"[red]git error:[/red] {e.stderr.strip()}")
        raise typer.Exit(1) from e
    except FileNotFoundError as e:
        console.print("[red]git not found. Is git installed?[/red]")
        raise typer.Exit(1) from e

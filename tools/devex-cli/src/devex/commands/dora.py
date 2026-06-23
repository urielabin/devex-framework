import json
from pathlib import Path
from typing import Annotated

import typer
import yaml
from rich.console import Console
from rich.table import Table

from devex.dora.collector import DoraMetrics, collect

console = Console()

app = typer.Typer(help="DORA metrics reporting.")


@app.command("report")
def report(
    days: Annotated[int, typer.Option("--days", "-d", help="Number of days of history to analyse")] = 90,
    output: Annotated[Path | None, typer.Option("--output", "-o", help="Write metrics to JSON file")] = None,
    emit_cloudwatch: Annotated[bool, typer.Option("--emit-cloudwatch", help="Emit metrics to AWS CloudWatch")] = False,
) -> None:
    """Compute and display DORA metrics from git history."""

    cwd = Path.cwd()
    console.print(f"[bold]Collecting DORA metrics[/bold] from [cyan]{cwd}[/cyan] (last {days} days)…\n")

    metrics = collect(cwd, days=days)

    table = Table(title="DORA Metrics", show_lines=True)
    table.add_column("Metric", style="bold")
    table.add_column("Value", justify="right")
    table.add_column("Performance")

    level = metrics.performance_level()
    level_color = {"Elite": "green", "High": "cyan", "Medium": "yellow", "Low": "red"}.get(level, "white")

    perf_cell = f"[{level_color}]{level}[/{level_color}]"
    table.add_row("Deployment Frequency", f"{metrics.deployment_frequency}/week", perf_cell)
    table.add_row("Lead Time for Changes", f"{metrics.lead_time_hours}h", "—")
    table.add_row("Change Failure Rate", f"{metrics.change_failure_rate:.1%}", "—")
    table.add_row("MTTR", f"{metrics.mttr_hours}h", "—")
    table.add_row("Total Commits Analysed", str(metrics.total_commits), "—")
    table.add_row("Total Deploys Detected", str(metrics.total_deploys), "—")

    console.print(table)

    if metrics.failure_commits:
        console.print("\n[yellow]Failure / revert commits detected:[/yellow]")
        for msg in metrics.failure_commits[:5]:
            console.print(f"  • {msg}")

    if output:
        data = {
            "deployment_frequency_per_week": metrics.deployment_frequency,
            "lead_time_hours": metrics.lead_time_hours,
            "change_failure_rate": metrics.change_failure_rate,
            "mttr_hours": metrics.mttr_hours,
            "total_commits": metrics.total_commits,
            "total_deploys": metrics.total_deploys,
            "performance_level": metrics.performance_level(),
        }
        output.write_text(json.dumps(data, indent=2))
        console.print(f"\n[green]Metrics written to {output}[/green]")

    if emit_cloudwatch:
        _emit_to_cloudwatch(metrics, cwd)


def _load_work_id_prefix(cwd: Path) -> str:
    devex_cfg_path = cwd / ".devex.yml"
    if not devex_cfg_path.exists():
        raise typer.BadParameter(
            "No .devex.yml found -- run 'devex init' first so metrics carry a TeamName/WorkIdPrefix "
            "dimension. Without it, this team's metrics would be indistinguishable from every other "
            "team's in the shared DevEx/DORA namespace."
        )
    cfg = yaml.safe_load(devex_cfg_path.read_text())
    prefix = cfg.get("work_id_prefix")
    if not prefix:
        raise typer.BadParameter(".devex.yml is missing work_id_prefix")
    return str(prefix)


def _emit_to_cloudwatch(metrics: DoraMetrics, cwd: Path) -> None:
    try:
        work_id_prefix = _load_work_id_prefix(cwd)
        import boto3

        cw = boto3.client("cloudwatch")
        # Same TeamName/WorkIdPrefix dimensions as @devex/workflow-framework's emitLeadTimeMetric(),
        # so a Python team's metrics are comparable to a TypeScript/Go team's in the same namespace.
        dimensions = [
            {"Name": "TeamName", "Value": work_id_prefix},
            {"Name": "WorkIdPrefix", "Value": work_id_prefix},
        ]
        cw.put_metric_data(
            Namespace="DevEx/DORA",
            MetricData=[
                {
                    "MetricName": "DeploymentFrequency",
                    "Value": metrics.deployment_frequency,
                    "Unit": "Count/Week",
                    "Dimensions": dimensions,
                },
                {
                    "MetricName": "LeadTimeForChanges",
                    "Value": metrics.lead_time_hours,
                    "Unit": "None",
                    "Dimensions": dimensions,
                },
                {
                    "MetricName": "ChangeFailureRate",
                    "Value": metrics.change_failure_rate,
                    "Unit": "None",
                    "Dimensions": dimensions,
                },
                {"MetricName": "MTTR", "Value": metrics.mttr_hours, "Unit": "None", "Dimensions": dimensions},
            ],
        )
        console.print(f"[green]Metrics emitted to CloudWatch namespace DevEx/DORA (team: {work_id_prefix})[/green]")
    except typer.BadParameter as e:
        console.print(f"[red]{e}[/red]")
    except Exception as e:
        console.print(f"[red]CloudWatch emission failed: {e}[/red]")

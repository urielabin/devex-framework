import typer

from devex import __version__
from devex.commands import branch, dora, init, standards

app = typer.Typer(
    name="devex",
    help="DevEx Platform CLI — Golden Path tooling for engineering teams.",
    no_args_is_help=True,
)

app.add_typer(init.app, name="init")
app.add_typer(standards.app, name="standards")
app.add_typer(branch.app, name="branch")
app.add_typer(dora.app, name="dora")


def _version_callback(value: bool) -> None:
    if value:
        typer.echo(f"devex {__version__}")
        raise typer.Exit()


@app.callback()
def main(
    version: bool = typer.Option(
        None, "--version", callback=_version_callback, is_eager=True, help="Show the version and exit."
    ),
) -> None:
    """DevEx CLI — enforce conventions, create branches, and track DORA metrics."""


if __name__ == "__main__":
    app()

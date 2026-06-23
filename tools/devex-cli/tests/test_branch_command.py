from unittest.mock import patch

from typer.testing import CliRunner

from devex.commands.branch import _slugify
from devex.main import app

runner = CliRunner()


def test_slugify_basic():
    assert _slugify("add payment endpoint") == "add-payment-endpoint"


def test_slugify_truncates_to_40():
    long_desc = "this is a very long description that exceeds the maximum length allowed"
    result = _slugify(long_desc, max_len=40)
    assert len(result) <= 40


def test_slugify_special_chars():
    assert _slugify("Add: Payment/Endpoint!") == "add-payment-endpoint"


def test_invalid_work_id_rejected():
    result = runner.invoke(app, ["branch", "create", "fin-123", "add feature"])
    assert result.exit_code != 0
    assert "Invalid Work ID" in result.output


def test_invalid_branch_type_rejected():
    with patch("devex.commands.branch.subprocess.run"):
        result = runner.invoke(app, ["branch", "create", "FIN-123", "add feature", "--type", "unknown"])
    assert result.exit_code != 0


def test_creates_correct_branch_name():
    """Verify the branch name passed to git checkout -b is correctly formed."""

    captured_args = []

    def fake_run(args, **kwargs):
        captured_args.extend(args)
        mock = type("R", (), {"returncode": 0, "stderr": ""})()
        return mock

    with patch("devex.commands.branch.subprocess.run", side_effect=fake_run):
        result = runner.invoke(app, ["branch", "create", "FIN-456", "add transaction list"])

    assert "feat/FIN-456-add-transaction-list" in captured_args
    assert result.exit_code == 0

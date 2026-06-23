from unittest.mock import MagicMock, patch

from typer.testing import CliRunner

from devex.main import app

runner = CliRunner()


def _make_mock_repo(branch_name: str, commit_msg: str):
    mock_repo = MagicMock()
    mock_repo.active_branch.name = branch_name
    mock_repo.head.commit.message = commit_msg
    return mock_repo


def test_failing_branch_no_work_id(tmp_path):
    """A branch name without a Work ID should fail the BRANCH_NAME check."""
    with patch("devex.commands.standards.git") as mock_git:
        mock_git.Repo.return_value = _make_mock_repo("my-feature", "some commit")
        mock_git.InvalidGitRepositoryError = Exception

        result = runner.invoke(app, ["standards", "check"], catch_exceptions=False)

    assert "BRANCH_NAME" in result.output
    assert result.exit_code != 0


def test_passing_branch(tmp_path):
    """A valid branch + Work ID commit should pass both checks (ignoring file checks)."""
    with (
        patch("devex.commands.standards.git") as mock_git,
        patch("devex.commands.standards.Path.cwd", return_value=tmp_path),
        patch("devex.commands.standards._write_audit_log"),
    ):
        mock_git.Repo.return_value = _make_mock_repo("feat/FIN-123-add-payment", "[FIN-123] add payment endpoint")
        mock_git.InvalidGitRepositoryError = Exception

        # Create the PR template so that check passes too
        (tmp_path / ".github").mkdir()
        (tmp_path / ".github" / "pull_request_template.md").write_text("# PR Template\nWork ID:")
        (tmp_path / ".devex.yml").write_text("work_id_prefix: FIN\n")

        result = runner.invoke(app, ["standards", "check"], catch_exceptions=False)

    assert "BRANCH_NAME" in result.output
    assert "✓" in result.output


def test_missing_pr_template(tmp_path):
    """Missing PR template should show a failure for PR_TEMPLATE check."""
    with (
        patch("devex.commands.standards.git") as mock_git,
        patch("devex.commands.standards.Path.cwd", return_value=tmp_path),
        patch("devex.commands.standards._write_audit_log"),
    ):
        mock_git.Repo.return_value = _make_mock_repo("feat/FIN-123-demo", "[FIN-123] demo commit")
        mock_git.InvalidGitRepositoryError = Exception

        result = runner.invoke(app, ["standards", "check"])

    assert "PR_TEMPLATE" in result.output
    assert result.exit_code != 0


def test_pre_push_mode_exits_nonzero_on_bad_branch(tmp_path):
    """Pre-push mode should exit 1 when branch fails convention."""
    with (
        patch("devex.commands.standards.git") as mock_git,
        patch("devex.commands.standards.Path.cwd", return_value=tmp_path),
        patch("devex.commands.standards._write_audit_log"),
    ):
        mock_git.Repo.return_value = _make_mock_repo("main", "WIP commit")
        mock_git.InvalidGitRepositoryError = Exception

        result = runner.invoke(app, ["standards", "check", "--pre-push"])

    assert result.exit_code != 0

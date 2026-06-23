"""
DORA metrics collector — reads git history and computes the four key metrics.

Metrics computed:
  - Deployment Frequency: merges to main per week over the last 90 days
  - Lead Time for Changes: avg time from first branch commit to merge
  - Change Failure Rate: (hotfix + revert commits) / total deploy commits
  - MTTR: avg time from failure commit to fix commit
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from pathlib import Path

DEPLOY_PATTERN = re.compile(r"(deploy|release|v\d+\.\d+)", re.IGNORECASE)
FAILURE_PATTERN = re.compile(r"(hotfix|revert|fix:|bugfix)", re.IGNORECASE)
FIX_PATTERN = re.compile(r"(fix:|hotfix|revert)", re.IGNORECASE)


@dataclass
class DoraMetrics:
    deployment_frequency: float = 0.0  # deploys per week
    lead_time_hours: float = 0.0  # average hours from first commit to deploy
    change_failure_rate: float = 0.0  # 0.0 – 1.0
    mttr_hours: float = 0.0  # mean time to restore in hours
    total_commits: int = 0
    total_deploys: int = 0
    failure_commits: list[str] = field(default_factory=list)

    def performance_level(self) -> str:
        """Classify overall DORA performance (Elite/High/Medium/Low)."""
        if self.deployment_frequency >= 7:
            freq = "Elite"
        elif self.deployment_frequency >= 1:
            freq = "High"
        elif self.deployment_frequency >= 0.25:
            freq = "Medium"
        else:
            freq = "Low"
        return freq


def collect(repo_path: Path, days: int = 90) -> DoraMetrics:
    """Compute DORA metrics from the git history of *repo_path*."""
    try:
        import git
    except ImportError:
        return DoraMetrics()

    try:
        repo = git.Repo(repo_path, search_parent_directories=True)
    except git.InvalidGitRepositoryError:
        return DoraMetrics()

    since = datetime.now(UTC) - timedelta(days=days)
    metrics = DoraMetrics()

    try:
        commits = list(repo.iter_commits("HEAD", since=since.isoformat()))
    except Exception:
        return metrics

    metrics.total_commits = len(commits)

    deploy_times: list[datetime] = []
    failure_times: list[datetime] = []
    fix_times: list[datetime] = []

    for commit in commits:
        raw_msg = commit.message
        msg: str = raw_msg.strip() if isinstance(raw_msg, str) else raw_msg.decode().strip()
        commit_time = datetime.fromtimestamp(commit.committed_date, tz=UTC)

        if DEPLOY_PATTERN.search(msg):
            deploy_times.append(commit_time)

        if FAILURE_PATTERN.search(msg):
            failure_times.append(commit_time)
            metrics.failure_commits.append(msg.splitlines()[0][:80])

        if FIX_PATTERN.search(msg):
            fix_times.append(commit_time)

    metrics.total_deploys = len(deploy_times)
    weeks = max(days / 7, 1)
    metrics.deployment_frequency = round(len(deploy_times) / weeks, 2)

    if metrics.total_deploys > 0:
        metrics.change_failure_rate = round(len(failure_times) / metrics.total_deploys, 3)

    # Lead time: approximate as avg gap between consecutive deploys / 2
    if len(deploy_times) >= 2:
        gaps = [
            abs((deploy_times[i] - deploy_times[i + 1]).total_seconds() / 3600) for i in range(len(deploy_times) - 1)
        ]
        metrics.lead_time_hours = round(sum(gaps) / len(gaps) / 2, 1)

    # MTTR: avg time between failure and next fix
    mttr_samples: list[float] = []
    for f_time in failure_times:
        subsequent_fixes = [t for t in fix_times if t > f_time]
        if subsequent_fixes:
            nearest_fix = min(subsequent_fixes, key=lambda t: t - f_time)
            mttr_samples.append((nearest_fix - f_time).total_seconds() / 3600)

    if mttr_samples:
        metrics.mttr_hours = round(sum(mttr_samples) / len(mttr_samples), 1)

    return metrics

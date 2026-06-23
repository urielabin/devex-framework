import re

BRANCH_NAME_PATTERN = re.compile(r"^(feat|fix|chore|refactor)/[A-Z]+-\d+-.+$")


def validate_branch_name(branch: str) -> bool:
    """Return True if branch follows the Golden Path convention.

    Expected format: <type>/<WORK-ID>-<description>
    Example: feat/FIN-123-add-payment-endpoint
    """
    return bool(BRANCH_NAME_PATTERN.match(branch))

import re

WORK_ID_PATTERN = re.compile(r"^[A-Z]+-\d+$")


def validate_work_id(work_id: str) -> bool:
    """Return True if work_id matches the Universal Work ID format (e.g. FIN-123)."""
    return bool(WORK_ID_PATTERN.match(work_id))

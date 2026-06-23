import re

COMMIT_MSG_PATTERN = re.compile(r"\[?[A-Z]+-\d+\]?")


def validate_commit_message(message: str) -> bool:
    """Return True if the commit message contains a Work ID reference.

    Accepts formats like: [FIN-123], FIN-123:, or FIN-123 anywhere in the message.
    """
    return bool(COMMIT_MSG_PATTERN.search(message))

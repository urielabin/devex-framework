"""
Property-Based Tests (PBT) for DevEx validators using Hypothesis.

These tests complement unit tests by generating hundreds of random inputs
to discover edge cases that hand-written tests miss.
"""

from hypothesis import given, settings
from hypothesis import strategies as st

from devex.validators.branch import validate_branch_name
from devex.validators.commit import validate_commit_message
from devex.validators.work_id import validate_work_id

# ── Work ID validator ──────────────────────────────────────────────────────────

VALID_WORK_ID_STRATEGY = st.from_regex(r"^[A-Z]{1,8}-\d{1,6}$", fullmatch=True)
INVALID_WORK_ID_STRATEGY = st.one_of(
    st.text(max_size=0),  # empty
    st.from_regex(r"^[a-z]+-\d+$", fullmatch=True),  # lowercase prefix
    st.from_regex(r"^[A-Z]+$", fullmatch=True),  # no number
    st.from_regex(r"^\d+-[A-Z]+$", fullmatch=True),  # reversed
)


@given(work_id=VALID_WORK_ID_STRATEGY)
@settings(max_examples=200)
def test_pbt_valid_work_ids_always_pass(work_id: str) -> None:
    """Any string matching [A-Z]+-\\d+ must be accepted."""
    assert validate_work_id(work_id) is True


@given(work_id=INVALID_WORK_ID_STRATEGY)
@settings(max_examples=200)
def test_pbt_invalid_work_ids_always_fail(work_id: str) -> None:
    """Strings that do not match the Work ID pattern must be rejected."""
    assert validate_work_id(work_id) is False


# ── Branch name validator ──────────────────────────────────────────────────────

VALID_BRANCH_STRATEGY = st.builds(
    lambda branch_type, prefix, number, desc: f"{branch_type}/{prefix}-{number}-{desc}",
    branch_type=st.sampled_from(["feat", "fix", "chore", "refactor"]),
    prefix=st.from_regex(r"[A-Z]{2,6}", fullmatch=True),
    number=st.integers(min_value=1, max_value=9999).map(str),
    desc=st.from_regex(r"[a-z][a-z0-9\-]{2,20}", fullmatch=True),
)


@given(branch=VALID_BRANCH_STRATEGY)
@settings(max_examples=200)
def test_pbt_valid_branches_always_pass(branch: str) -> None:
    """Any correctly-formed branch name must be accepted."""
    assert validate_branch_name(branch) is True


@given(branch=st.from_regex(r"^[A-Z]+-\d+.*$", fullmatch=True))
@settings(max_examples=100)
def test_pbt_branches_missing_type_prefix_always_fail(branch: str) -> None:
    """A branch starting directly with a Work ID (no type/) must be rejected."""
    assert validate_branch_name(branch) is False


# ── Commit message validator ───────────────────────────────────────────────────

VALID_COMMIT_STRATEGY = st.builds(
    lambda prefix, num, rest: f"[{prefix}-{num}] {rest}",
    prefix=st.from_regex(r"[A-Z]{2,6}", fullmatch=True),
    num=st.integers(min_value=1, max_value=9999).map(str),
    rest=st.text(min_size=5, max_size=80),
)


@given(msg=VALID_COMMIT_STRATEGY)
@settings(max_examples=200)
def test_pbt_commit_with_work_id_always_passes(msg: str) -> None:
    """Any commit message containing [PREFIX-NUM] must be accepted."""
    assert validate_commit_message(msg) is True


@given(msg=st.text(alphabet=st.characters(blacklist_categories=("Lu",)), min_size=1, max_size=100))
@settings(max_examples=100)
def test_pbt_work_id_regex_is_deterministic(msg: str) -> None:
    """validate_commit_message must never raise — it is always True or False."""
    result = validate_commit_message(msg)
    assert isinstance(result, bool)

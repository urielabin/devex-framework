from devex.validators.work_id import validate_work_id


def test_valid_work_id():
    assert validate_work_id("FIN-123") is True


def test_valid_work_id_single_digit():
    assert validate_work_id("PLAT-9") is True


def test_valid_work_id_multi_char_prefix():
    assert validate_work_id("ABC-100") is True


def test_invalid_lowercase_prefix():
    assert validate_work_id("fin-123") is False


def test_invalid_no_number():
    assert validate_work_id("FIN") is False


def test_invalid_no_prefix():
    assert validate_work_id("123") is False


def test_invalid_empty_string():
    assert validate_work_id("") is False


def test_invalid_reversed():
    assert validate_work_id("123-FIN") is False

import pytest

from app.schemas.validators import sanitize_text, validate_slug


class TestSanitization:
    def test_strips_html_tags(self) -> None:
        assert sanitize_text("<script>alert(1)</script>Hello") == "alert(1)Hello"

    def test_strips_control_characters(self) -> None:
        assert sanitize_text("Hello\x00World") == "HelloWorld"

    def test_valid_slug(self) -> None:
        assert validate_slug("Margaret-Thompson-2") == "margaret-thompson-2"

    def test_invalid_slug_raises(self) -> None:
        with pytest.raises(ValueError):
            validate_slug("Invalid Slug!")

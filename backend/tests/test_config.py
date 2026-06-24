import pytest
from pydantic import ValidationError

from app.core.config import Settings


class TestProductionConfigValidation:
    def test_production_rejects_default_secret(self) -> None:
        with pytest.raises(ValidationError) as exc:
            Settings(environment="production", secret_key="change-me-in-production")
        assert "SECRET_KEY" in str(exc.value)

    def test_production_rejects_localhost_cors_origins(self) -> None:
        with pytest.raises(ValidationError) as exc:
            Settings(
                environment="production",
                secret_key="super-secret-value",
                cors_origins=["http://localhost:3000"],
            )
        assert "CORS_ORIGINS" in str(exc.value)

    def test_development_allows_default_secret(self) -> None:
        settings = Settings(environment="development", secret_key="change-me-in-production")
        assert settings.secret_key == "change-me-in-production"

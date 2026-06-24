from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


class TestSecurityMiddleware:
    def test_health_endpoint(self) -> None:
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}

    def test_production_security_headers(self) -> None:
        response = client.get("/health")
        assert response.headers["X-Content-Type-Options"] == "nosniff"
        assert response.headers["X-Frame-Options"] == "DENY"
        assert "default-src 'none'" in response.headers["Content-Security-Policy"]
        assert response.headers["Referrer-Policy"] == "strict-origin-when-cross-origin"

    def test_cors_rejects_wildcard_origin(self) -> None:
        response = client.get(
            "/health",
            headers={"Origin": "https://evil.example"},
        )
        assert response.headers.get("access-control-allow-origin") != "*"

    def test_cors_allows_configured_origin(self) -> None:
        response = client.options(
            "/health",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"

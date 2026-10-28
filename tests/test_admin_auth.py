import os
from unittest.mock import patch

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from dse_collector.admin_auth import (
    COOKIE_NAME, admin_guard_response, new_session, valid_session,
    verify_credentials, same_origin,
)

ENV = {
    "ADMIN_USERNAME": "test-admin",
    "ADMIN_PASSWORD": "not-a-real-secret-password",
    "ADMIN_SESSION_SECRET": "test-only-session-secret-more-than-32-characters",
}


def make_request(path, method="GET", origin="https://app.example.com", cookie=""):
    headers = [(b"host", b"app.example.com"), (b"origin", origin.encode())]
    if cookie:
        headers.append((b"cookie", f"{COOKIE_NAME}={cookie}".encode()))
    return Request({"type": "http", "method": method, "path": path,
                    "headers": headers, "scheme": "https", "server": ("app.example.com", 443)})


def test_missing_config_fails_closed():
    with patch.dict(os.environ, {}, clear=True):
        with pytest.raises(HTTPException) as error:
            verify_credentials("admin", "password")
        assert error.value.status_code == 503


def test_login_credentials_are_from_environment():
    with patch.dict(os.environ, ENV):
        assert verify_credentials("test-admin", ENV["ADMIN_PASSWORD"])
        assert not verify_credentials("test-admin", "wrong")
        assert not verify_credentials("wrong", ENV["ADMIN_PASSWORD"])


def test_signed_session_expiry_and_tampering():
    with patch.dict(os.environ, ENV):
        token = new_session()
        assert valid_session(token)
        assert not valid_session(token + "x")
        assert not valid_session(None)


def test_sensitive_api_requires_session_and_same_origin_for_writes():
    with patch.dict(os.environ, ENV):
        token = new_session()
        assert admin_guard_response(make_request("/api/agents/broker/reset", "POST")).status_code == 401
        assert admin_guard_response(make_request("/api/portfolio/real/balance", "POST")).status_code == 401
        assert admin_guard_response(make_request("/api/agents/broker/reset", "POST", "https://evil.example", token)).status_code == 403
        assert admin_guard_response(make_request("/api/agents/broker/reset", "POST", cookie=token)) is None
        assert admin_guard_response(make_request("/api/market/overview")) is None
        assert same_origin(make_request("/api/auth/login"))

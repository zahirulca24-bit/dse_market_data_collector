"""Environment-configured administrator login with signed, expiring HttpOnly sessions."""
from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets
import time

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse

COOKIE_NAME = "dse_admin_session"
SESSION_SECONDS = 8 * 60 * 60
_LOGIN_FAILURES: dict[str, list[float]] = {}


def _config() -> tuple[str, str, str]:
    username = os.getenv("ADMIN_USERNAME", "")
    password = os.getenv("ADMIN_PASSWORD", "")
    secret = os.getenv("ADMIN_SESSION_SECRET", "")
    if not username or len(password) < 12 or len(secret) < 32:
        raise HTTPException(status_code=503, detail="Admin login is not configured")
    return username, password, secret


def _sign(data: str, secret: str) -> str:
    return hmac.new(secret.encode(), data.encode(), hashlib.sha256).hexdigest()


def new_session() -> str:
    _, _, secret = _config()
    payload = f"{int(time.time())}.{secrets.token_urlsafe(16)}"
    return base64.urlsafe_b64encode(payload.encode()).decode().rstrip("=") + "." + _sign(payload, secret)


def valid_session(token: str | None) -> bool:
    if not token:
        return False
    try:
        encoded, signature = token.rsplit(".", 1)
        payload = base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4)).decode()
        issued_text, nonce = payload.split(".", 1)
        issued = int(issued_text)
        _, _, secret = _config()
        return (
            bool(nonce)
            and 0 <= time.time() - issued <= SESSION_SECONDS
            and hmac.compare_digest(_sign(payload, secret), signature)
        )
    except (ValueError, UnicodeError, HTTPException):
        return False


def verify_credentials(username: str, password: str) -> bool:
    expected_user, expected_password, _ = _config()
    return hmac.compare_digest(username.encode(), expected_user.encode()) and hmac.compare_digest(
        hashlib.sha256(password.encode()).digest(), hashlib.sha256(expected_password.encode()).digest()
    )


def allow_login_attempt(remote: str) -> bool:
    now = time.monotonic()
    attempts = [t for t in _LOGIN_FAILURES.get(remote, []) if now - t < 900]
    _LOGIN_FAILURES[remote] = attempts
    return len(attempts) < 5


def record_login_failure(remote: str) -> None:
    _LOGIN_FAILURES.setdefault(remote, []).append(time.monotonic())


def clear_login_failures(remote: str) -> None:
    _LOGIN_FAILURES.pop(remote, None)


def same_origin(request: Request) -> bool:
    origin = request.headers.get("origin")
    if not origin:
        return False
    # The Host header is controlled by the deployed reverse proxy. Explicit
    # origin comparison stops cross-origin cookie-backed mutations.
    host = request.headers.get("host", "")
    return origin in {f"https://{host}", f"http://{host}"}


def require_admin_cookie(request: Request) -> None:
    if not valid_session(request.cookies.get(COOKIE_NAME)):
        raise HTTPException(status_code=401, detail="Admin login required")


def admin_guard_response(request: Request):
    """Protect sensitive API prefixes, including reads of private portfolio data."""
    path = request.url.path
    sensitive = (
        path.startswith("/api/agents/")
        or path.startswith("/api/portfolio/real")
        or path.startswith("/api/reports/")
    )
    if not sensitive:
        return None
    if not valid_session(request.cookies.get(COOKIE_NAME)):
        return JSONResponse({"detail": "Admin login required"}, status_code=401)
    if request.method not in ("GET", "HEAD", "OPTIONS") and not same_origin(request):
        return JSONResponse({"detail": "Cross-origin mutation denied"}, status_code=403)
    return None

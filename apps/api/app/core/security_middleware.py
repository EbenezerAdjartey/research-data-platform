"""Security middleware: rate limiting, request validation, security headers."""
import time
from collections import defaultdict
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

# Simple in-memory rate limiter (use Redis in production)
_request_counts: dict[str, list[float]] = defaultdict(list)
RATE_LIMIT_WINDOW = 60  # seconds
RATE_LIMIT_MAX = 100  # requests per window
AUTH_RATE_LIMIT_MAX = 20  # stricter for auth endpoints


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        client_ip = request.client.host if request.client else "unknown"
        now = time.time()
        path = request.url.path

        # Determine rate limit based on endpoint
        is_auth = "/auth/" in path
        max_requests = AUTH_RATE_LIMIT_MAX if is_auth else RATE_LIMIT_MAX

        # Clean old entries
        _request_counts[client_ip] = [
            t for t in _request_counts[client_ip] if now - t < RATE_LIMIT_WINDOW
        ]

        if len(_request_counts[client_ip]) >= max_requests:
            return Response(
                content='{"detail":"Rate limit exceeded. Please try again later."}',
                status_code=429,
                media_type="application/json",
                headers={"Retry-After": str(RATE_LIMIT_WINDOW)},
            )

        _request_counts[client_ip].append(now)
        response = await call_next(request)
        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        return response


# File upload validation
ALLOWED_EXTENSIONS = {'.csv', '.xlsx', '.xls', '.sav', '.sas7bdat', '.dta', '.parquet'}
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB


def validate_upload_file(filename: str, file_size: int | None = None) -> str | None:
    """Return error message if file is invalid, None if OK."""
    import os
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        return f"File type '{ext}' not allowed. Supported: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
    if file_size and file_size > MAX_FILE_SIZE:
        return f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)}MB."
    return None

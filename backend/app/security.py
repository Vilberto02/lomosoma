"""Request limits, CSRF and response hardening for proxy and direct API traffic."""
import hmac
import logging
import uuid
from ipaddress import ip_address

from fastapi import HTTPException
from starlette.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from backend.app.auth import COOKIE, csrf_for
from backend.app.settings import settings
from backend.app.storage import rate_limit

logger = logging.getLogger("lomosoma.security")


class SecurityMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        request_id = uuid.uuid4().hex
        try:
            if settings().production and request.url.path.startswith("/api") and request.url.path != "/api/health":
                secret = settings().proxy_secret
                if not secret or not hmac.compare_digest(request.headers.get("x-lomosoma-proxy", ""), secret):
                    raise HTTPException(403, "Acceso permitido únicamente desde la aplicación")
                try:
                    client_ip = str(ip_address(request.headers.get("x-lomosoma-client-ip", "")))
                except ValueError:
                    raise HTTPException(400, "No se pudo validar la solicitud") from None
                request.scope["client"] = (client_ip, 0)
            if request.method in ("POST", "PUT", "PATCH", "DELETE"):
                origin = request.headers.get("origin", "")
                if (settings().production or origin) and origin not in settings().allowed_origins:
                    raise HTTPException(403, "Origen no permitido")
                raw = request.cookies.get(COOKIE)
                if raw and not hmac.compare_digest(request.headers.get("x-csrf-token", ""), csrf_for(raw)):
                    raise HTTPException(403, "Validación de sesión requerida")
            length = request.headers.get("content-length")
            if length and (not length.isdigit() or int(length) > 16384):
                raise HTTPException(413, "Solicitud demasiado grande")
            if request.method in ("POST", "PUT", "PATCH", "DELETE"):
                content = bytearray()
                async for chunk in request.stream():
                    content.extend(chunk)
                    if len(content) > 16384:
                        raise HTTPException(413, "Solicitud demasiado grande")
                request._body = bytes(content)
            if request.url.path.startswith("/api") and request.url.path != "/api/health":
                from starlette.concurrency import run_in_threadpool
                await run_in_threadpool(rate_limit, "api-ip", request.client.host, 300)
            response = await call_next(request)
        except HTTPException as exc:
            response = JSONResponse({"detail": exc.detail}, status_code=exc.status_code, headers=exc.headers)
        except Exception as exc:
            logger.error("request_failed id=%s type=%s", request_id, type(exc).__name__)
            response = JSONResponse({"detail": "Error interno. Inténtalo más tarde", "request_id": request_id}, status_code=500)
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Cache-Control"] = "no-store"
        if settings().production:
            response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
            response.headers["Strict-Transport-Security"] = "max-age=31536000"
        return response

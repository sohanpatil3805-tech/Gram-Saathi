"""Gram Saathi FastAPI application entry point."""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.routes import create_router
from backend.config import settings
from backend.db.session import init_db
from backend.schemes.repository import SchemeRepository


def create_app() -> FastAPI:
    # Ensure database schema is initialized on startup
    init_db()

    app = FastAPI(
        title="Gram Saathi API",
        description=(
            "Rural government scheme discovery and preliminary eligibility guidance. "
            "Responses are informational and are not official government decisions."
        ),
        version="0.1.0",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )

    try:
        from backend.middleware.rate_limiter import limiter
        from slowapi.errors import RateLimitExceeded
        from slowapi import _rate_limit_exceeded_handler
        if limiter:
            app.state.limiter = limiter
            app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    except Exception:
        pass

    repository = SchemeRepository()
    app.include_router(create_router(repository, prefix="/api"))
    app.include_router(create_router(repository, prefix="/api/v1"))

    @app.get("/health", tags=["health"])
    def health() -> dict[str, str]:
        return {"status": "ok", "service": "gram-saathi-api"}

    return app


app = create_app()

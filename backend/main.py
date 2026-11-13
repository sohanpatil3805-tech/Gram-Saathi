"""Gram Saathi FastAPI application entry point."""
from __future__ import annotations

from fastapi import FastAPI

from backend.api.routes import create_router
from backend.schemes.repository import SchemeRepository


def create_app() -> FastAPI:
    app = FastAPI(
        title="Gram Saathi API",
        description=(
            "Rural government scheme discovery and preliminary eligibility guidance. "
            "Responses are informational and are not official government decisions."
        ),
        version="0.1.0",
    )
    repository = SchemeRepository()
    app.include_router(create_router(repository))

    @app.get("/health", tags=["health"])
    def health() -> dict[str, str]:
        return {"status": "ok", "service": "gram-saathi-api"}

    return app


app = create_app()

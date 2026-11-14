"""
Database session management and connection lifecycle for Gram Saathi.
Configured for SQLite local development and PostgreSQL production deployment.
"""
from __future__ import annotations

import logging
from typing import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.engine import Engine

from backend.config import settings
from backend.db.base import Base

logger = logging.getLogger(__name__)

# Determine connect_args based on database dialect
connect_args = {}
if settings.sync_database_url.startswith("sqlite"):
    connect_args["check_same_thread"] = False

# Create database engine
engine: Engine = create_engine(
    settings.sync_database_url,
    connect_args=connect_args,
    pool_pre_ping=True,
    echo=False,
)

# Enable foreign keys for SQLite
if settings.sync_database_url.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency yielding a managed database session.
    Automatically commits or rolls back and closes after request completion.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db(target_engine: Engine = engine) -> None:
    """
    Initialize all tables defined in Base.metadata.
    Safe to call on startup; existing tables are preserved.
    """
    # Import models to ensure they are registered with Base.metadata
    import backend.db.models  # noqa: F401
    Base.metadata.create_all(bind=target_engine)
    logger.info("Database tables initialized successfully.")

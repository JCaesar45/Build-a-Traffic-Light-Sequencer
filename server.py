from __future__ import annotations

import re
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator, Literal

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field, field_validator

DB_PATH = Path(__file__).parent / "meridian.db"
CURRENT_CYCLE = "09"
ALLOCATION_TOTAL = 18
RATE_LIMIT_WINDOW_SECONDS = 60
RATE_LIMIT_MAX_REQUESTS = 5

app = FastAPI(title="Meridian Atelier API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

_rate_buckets: dict[str, list[float]] = {}


def _init_db() -> None:
    with _connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS applications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                cycle TEXT NOT NULL,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                country TEXT NOT NULL,
                note TEXT NOT NULL,
                created_at REAL NOT NULL
            )
            """
        )
        conn.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_cycle_email ON applications (cycle, email)"
        )
        conn.commit()


@contextmanager
def _connect() -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


class ApplicationIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    country: str = Field(min_length=2, max_length=80)
    note: str = Field(min_length=20, max_length=600)

    @field_validator("name", "country", "note")
    @classmethod
    def _strip_whitespace(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("This field cannot be blank.")
        return cleaned

    @field_validator("note")
    @classmethod
    def _reject_links(cls, value: str) -> str:
        if re.search(r"https?://", value, re.IGNORECASE):
            raise ValueError("Links aren't accepted in the application note.")
        return value


class ApplicationOut(BaseModel):
    id: int
    queue_position: int
    cycle: str
    status: Literal["received", "duplicate"]


class StatusOut(BaseModel):
    cycle: str
    allocation_total: int
    applications_received: int
    spots_remaining: int


def _client_key(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _enforce_rate_limit(request: Request) -> None:
    key = _client_key(request)
    now = time.monotonic()
    window_start = now - RATE_LIMIT_WINDOW_SECONDS
    hits = [t for t in _rate_buckets.get(key, []) if t > window_start]
    if len(hits) >= RATE_LIMIT_MAX_REQUESTS:
        raise HTTPException(status_code=429, detail="Too many attempts. Try again shortly.")
    hits.append(now)
    _rate_buckets[key] = hits


@app.on_event("startup")
def on_startup() -> None:
    _init_db()


@app.get("/api/status", response_model=StatusOut)
def get_status() -> StatusOut:
    with _connect() as conn:
        row = conn.execute(
            "SELECT COUNT(*) AS total FROM applications WHERE cycle = ?", (CURRENT_CYCLE,)
        ).fetchone()
    received = row["total"] if row else 0
    remaining = max(ALLOCATION_TOTAL - received, 0)
    return StatusOut(
        cycle=CURRENT_CYCLE,
        allocation_total=ALLOCATION_TOTAL,
        applications_received=received,
        spots_remaining=remaining,
    )


@app.post("/api/applications", response_model=ApplicationOut)
def create_application(payload: ApplicationIn, request: Request) -> ApplicationOut:
    _enforce_rate_limit(request)

    with _connect() as conn:
        existing = conn.execute(
            "SELECT id FROM applications WHERE cycle = ? AND email = ?",
            (CURRENT_CYCLE, payload.email.lower()),
        ).fetchone()

        if existing is not None:
            position_row = conn.execute(
                "SELECT COUNT(*) AS ahead FROM applications WHERE cycle = ? AND id <= ?",
                (CURRENT_CYCLE, existing["id"]),
            ).fetchone()
            return ApplicationOut(
                id=existing["id"],
                queue_position=position_row["ahead"],
                cycle=CURRENT_CYCLE,
                status="duplicate",
            )

        cursor = conn.execute(
            """
            INSERT INTO applications (cycle, name, email, country, note, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                CURRENT_CYCLE,
                payload.name,
                payload.email.lower(),
                payload.country,
                payload.note,
                time.time(),
            ),
        )
        conn.commit()
        new_id = cursor.lastrowid

        position_row = conn.execute(
            "SELECT COUNT(*) AS ahead FROM applications WHERE cycle = ? AND id <= ?",
            (CURRENT_CYCLE, new_id),
        ).fetchone()

    return ApplicationOut(
        id=new_id,
        queue_position=position_row["ahead"],
        cycle=CURRENT_CYCLE,
        status="received",
    )

"""
schemas.py — Pydantic request/response models for the Kredz hashing API.
"""

from pydantic import BaseModel, Field, EmailStr
from typing import Any, Literal


# ─── Credential types supported by Kredz ─────────────────────────────────

CredentialType = Literal[
    "github_project",
    "certificate",
    "internship",
    "hackathon",
    "lab_assignment",
    "other",
]


# ─── Generate Hash ─────────────────────────────────────────────────────────────

class GenerateHashResponse(BaseModel):
    bundle_hash: str = Field(
        ...,
        description="SHA-256 hex digest of the canonical bundle payload. Stored permanently — cannot be regenerated for the same email.",
        examples=["a3f1c2..."],
    )
    file_hashes: list[str] = Field(
        ...,
        description="Sorted list of individual SHA-256 file digests.",
    )
    metadata_used: dict[str, Any] = Field(
        ...,
        description="Exact metadata dict included in the hash (includes upload_timestamp and credential_type).",
    )
    qr_token: str = Field(
        ...,
        description="Short token derived from bundle_hash — used to generate the public QR verification URL.",
    )
    locked: bool = Field(
        default=True,
        description="Always True after first upload. Indicates this credential bundle is now immutable.",
    )


# ─── Verify Hash ──────────────────────────────────────────────────────────────

class VerifyHashResponse(BaseModel):
    valid: bool = Field(
        ...,
        description="True if the recomputed hash matches the stored bundle_hash.",
    )
    detail: str = Field(
        ...,
        description="Human-readable explanation of the result.",
    )
    credential_type: CredentialType | None = Field(
        default=None,
        description="The type of credential that was verified, if valid.",
    )
    owner_email_hash: str | None = Field(
        default=None,
        description="SHA-256 of the owner's email — returned on valid verification so identity is confirmable without exposing raw email.",
    )


# ─── Lock Status ──────────────────────────────────────────────────────────────

class LockStatusResponse(BaseModel):
    email_hash: str = Field(
        ...,
        description="SHA-256 of the queried email — raw email is never stored or returned.",
    )
    is_locked: bool = Field(
        ...,
        description="True if this email already has a committed bundle. Further uploads will be rejected.",
    )
    credential_types_committed: list[CredentialType] = Field(
        default_factory=list,
        description="List of credential types already locked for this email.",
    )
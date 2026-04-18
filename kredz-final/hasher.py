"""
hasher.py — Core cryptographic hashing logic for Kredz credential integrity.

Design principles:
  - Deterministic: same inputs always produce the same hash
  - Tamper-evident: any 1-byte change in files or metadata changes the bundle_hash
  - Content-only: file names are ignored; only binary content is hashed
  - One-time lock: once a bundle is committed for an email, it cannot be replaced
  - No randomness, no side effects, no file storage
"""

import hashlib
import hmac
import json
import copy
from datetime import datetime, timezone


# ─────────────────────────────────────────────
# STEP 1: Hash a single file's binary content
# ─────────────────────────────────────────────

def hash_file(content: bytes) -> str:
    """
    Compute the SHA-256 hex digest of raw file bytes.

    Args:
        content: Raw binary content of the file.

    Returns:
        Lowercase hex string of the SHA-256 digest (64 chars).

    Note:
        File names are intentionally excluded. Only content matters.
        This ensures the same file with a different name produces the same hash.
    """
    return hashlib.sha256(content).hexdigest()


# ─────────────────────────────────────────────
# STEP 2: Hash an email address (for identity
#         anchoring without storing raw email)
# ─────────────────────────────────────────────

def hash_email(email: str) -> str:
    """
    Produce a SHA-256 digest of the lowercased, stripped email.
    Used as the identity anchor for one-time upload enforcement.
    The raw email is never stored anywhere in the system.

    Args:
        email: Raw email address string.

    Returns:
        64-char lowercase hex digest.
    """
    normalised = email.strip().lower()
    return hashlib.sha256(normalised.encode("utf-8")).hexdigest()


# ─────────────────────────────────────────────
# STEP 3: Derive a short public QR token from
#         the bundle_hash
# ─────────────────────────────────────────────

def derive_qr_token(bundle_hash: str) -> str:
    """
    Derive a short, URL-safe token from the bundle_hash.
    This token is used to construct the public QR verification URL
    (e.g. https://kredz.app/verify/<qr_token>).

    It is NOT a secret — it is a stable public identifier.
    The full bundle_hash is still required for cryptographic verification.

    Args:
        bundle_hash: The 64-char hex bundle_hash.

    Returns:
        First 24 characters of a secondary SHA-256 over the bundle_hash.
        Collision probability is negligible for portfolio-scale usage.
    """
    return hashlib.sha256(bundle_hash.encode("utf-8")).hexdigest()[:24]


# ─────────────────────────────────────────────
# STEP 4: Generate a deterministic bundle hash
# ─────────────────────────────────────────────

def generate_bundle_hash(
    file_contents: list[bytes],
    metadata: dict,
    email: str,
) -> dict:
    """
    Generate a tamper-proof bundle hash from file contents, metadata, and
    the owner's email. The upload timestamp is captured once here and
    embedded into the hash payload — it is returned in metadata_used so
    callers can store and re-supply it for future verification.

    Determinism guarantees:
      1. Each file is hashed independently with SHA-256.
      2. File hashes are SORTED — upload order does not matter.
      3. Metadata keys are sorted via json.dumps(..., sort_keys=True).
      4. The owner's email_hash is included in the payload.
      5. The upload_timestamp is captured ONCE here and stored — it is never
         regenerated on verify (fixes the timestamp verification bug).
      6. A final SHA-256 pass over the canonical JSON string yields bundle_hash.

    Args:
        file_contents:  List of raw bytes, one per uploaded file.
        metadata:       JSON-serialisable dict — must include 'credential_type'.
                        All values must be JSON primitives (str, int, float,
                        bool, None, list, dict) — no datetime objects or sets.
        email:          Owner's email address. Hashed before inclusion.

    Returns:
        {
            "bundle_hash":    "<64-char hex>",
            "file_hashes":    ["<hex>", ...],   # sorted
            "metadata_used":  { ... },           # includes email_hash + upload_timestamp
            "qr_token":       "<24-char hex>",
            "locked":         True,
        }

    Raises:
        ValueError: If file_contents is empty or metadata is not JSON-serialisable.
    """
    if not file_contents:
        raise ValueError("At least one file must be provided.")

    # Validate metadata is fully JSON-serialisable before proceeding.
    # Catches datetime objects, sets, or other non-serialisable types early
    # rather than letting json.dumps throw an unhandled TypeError later.
    try:
        json.dumps(metadata)
    except (TypeError, ValueError) as exc:
        raise ValueError(
            f"metadata contains non-JSON-serialisable values: {exc}"
        )

    # 1. Hash each file independently
    file_hashes: list[str] = [hash_file(content) for content in file_contents]

    # 2. Sort for determinism — upload order must not affect the result
    file_hashes.sort()

    # 3. Deep copy metadata — protects against nested mutation by caller
    metadata_snapshot: dict = copy.deepcopy(metadata)

    # 4. Embed identity anchor (hashed email, never raw)
    metadata_snapshot["email_hash"] = hash_email(email)

    # 5. Capture upload timestamp ONCE and store it in metadata_used.
    #    This value must be re-supplied by the caller during verify — it is
    #    never regenerated (doing so would make verify always return False).
    metadata_snapshot["upload_timestamp"] = datetime.now(timezone.utc).isoformat()

    # 6. Build canonical payload and serialise deterministically
    payload = {
        "file_hashes": file_hashes,
        "metadata": metadata_snapshot,
    }
    canonical_string: str = json.dumps(payload, sort_keys=True, separators=(",", ":"))

    # 7. Final SHA-256 over canonical string → bundle_hash
    bundle_hash: str = hashlib.sha256(canonical_string.encode("utf-8")).hexdigest()

    # 8. Derive short public QR token from bundle_hash
    qr_token: str = derive_qr_token(bundle_hash)

    return {
        "bundle_hash":   bundle_hash,
        "file_hashes":   file_hashes,
        "metadata_used": metadata_snapshot,   # caller MUST persist this entire dict
        "qr_token":      qr_token,
        "locked":        True,
    }


# ─────────────────────────────────────────────
# STEP 5: Verify an existing bundle hash
# ─────────────────────────────────────────────

def verify_bundle_hash(
    file_contents: list[bytes],
    metadata_used: dict,
    expected_hash: str,
    email: str,
) -> bool:
    """
    Re-derive the bundle hash from the supplied inputs and compare it
    against the stored expected_hash using constant-time comparison.

    IMPORTANT: metadata_used must be the EXACT dict returned by
    generate_bundle_hash (including email_hash and upload_timestamp).
    Do not reconstruct it — persist and re-supply it as-is.

    Args:
        file_contents:  Raw file bytes (same files originally hashed).
        metadata_used:  The metadata_used dict from generate_bundle_hash.
                        Must include email_hash and upload_timestamp.
        expected_hash:  The bundle_hash produced at generation time.
        email:          Owner's email. Re-hashed and compared against
                        the email_hash stored in metadata_used.

    Returns:
        True  — bundle is intact and email matches.
        False — tampered, wrong email, or hash mismatch.
    """
    # Guard: confirm the email matches the identity anchor in stored metadata
    if metadata_used.get("email_hash") != hash_email(email):
        return False

    # Re-derive hash using stored metadata (timestamp is already in metadata_used,
    # so we do NOT call generate_bundle_hash — that would capture a new timestamp
    # and always produce a different hash).
    if not file_contents:
        return False

    file_hashes: list[str] = [hash_file(content) for content in file_contents]
    file_hashes.sort()

    payload = {
        "file_hashes": file_hashes,
        "metadata": metadata_used,
    }
    canonical_string: str = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    computed_hash: str = hashlib.sha256(canonical_string.encode("utf-8")).hexdigest()

    # hmac.compare_digest prevents timing attacks (constant-time comparison)
    return hmac.compare_digest(computed_hash, expected_hash)
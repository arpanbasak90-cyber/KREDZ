import asyncio
import json
import os
import secrets
import smtplib
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage
from pathlib import Path
from typing import Optional

import qrcode
from fastapi import FastAPI, File, Form, Request, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, EmailStr, Field
from dotenv import load_dotenv

from database import db_insert, db_select, db_update
from ai_verifier import trigger_verification

# ── Hashing module integration ────────────────────────────────────────
from hasher import generate_bundle_hash, verify_bundle_hash
from schemas import GenerateHashResponse, VerifyHashResponse

load_dotenv()

SMTP_HOST     = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT     = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER     = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")

NGROK_URL     = os.getenv("NGROK_URL", "http://localhost:8000")
APP_FRONT_URL = os.getenv("APP_FRONT_URL", "http://localhost:5173")

# ── App setup ─────────────────────────────────────────────────────────
app = FastAPI(title="Kredz Backend", version="2.1.0")

# ── CORS ──────────────────────────────────────────────────────────────
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:8080").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).parent.resolve()
QR_DIR   = BASE_DIR / "static" / "qrcodes"
QR_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")
templates = Jinja2Templates(directory="templates")

# ── Pydantic Models ───────────────────────────────────────────────────
class StudentCreate(BaseModel):
    name:        str
    institution: str
    email:       EmailStr
    password:    str = Field(min_length=8)

class StudentLogin(BaseModel):
    email:    EmailStr
    password: str

class MentorCreate(BaseModel):
    full_name:   str
    institution: str
    email:       EmailStr
    password:    str = Field(min_length=8)

class MentorLogin(BaseModel):
    email:    EmailStr
    password: str

VALID_TYPES = {"Project", "Internship", "Hackathon", "Research", "Coursework"}

# ── Email helper ──────────────────────────────────────────────────────
def send_qr_email(to_email: str, mentor_name: str, student_name: str,
                  project_name: str, deep_link: str, qr_image_path: str) -> bool:
    """
    Send the QR code to the mentor's email with a deep-link.
    Returns True on success, False on failure.
    """
    if not SMTP_USER or not SMTP_PASSWORD:
        return False   # SMTP not configured — skip silently
    try:
        msg = MIMEMultipart("related")
        msg["Subject"] = f"[Kredz] Please verify {student_name}'s credential — {project_name}"
        msg["From"]    = SMTP_USER
        msg["To"]      = to_email

        html_body = f"""
        <html><body style="font-family:sans-serif;color:#1e293b;max-width:600px;margin:0 auto;padding:24px">
          <h2 style="color:#7c3aed">⛓ Kredz — Credential Verification Request</h2>
          <p>Hi <strong>{mentor_name}</strong>,</p>
          <p>
            <strong>{student_name}</strong> has submitted a credential and listed you as their mentor.
            Please scan the QR code below or click the link to review and verify it in your Kredz dashboard.
          </p>
          <div style="text-align:center;margin:32px 0">
            <img src="cid:qrcode" width="220" height="220" alt="QR Code"
                 style="border:1px solid #e2e8f0;border-radius:12px;padding:12px"/>
            <br/>
            <a href="{deep_link}"
               style="display:inline-block;margin-top:16px;padding:12px 28px;background:#7c3aed;color:#fff;
                      text-decoration:none;border-radius:8px;font-weight:600;font-size:15px">
              Open in Kredz Dashboard
            </a>
          </div>
          <p style="color:#64748b;font-size:13px">
            <strong>Project:</strong> {project_name}<br/>
            Alternatively, copy this link: <a href="{deep_link}">{deep_link}</a>
          </p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
          <p style="font-size:12px;color:#94a3b8">Secured by ⛓ Kredz · Do not share this link.</p>
        </body></html>
        """

        alt = MIMEMultipart("alternative")
        alt.attach(MIMEText(html_body, "html"))
        msg.attach(alt)

        with open(qr_image_path, "rb") as f:
            img = MIMEImage(f.read())
        img.add_header("Content-ID", "<qrcode>")
        img.add_header("Content-Disposition", "inline", filename="qr.png")
        msg.attach(img)

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_USER, to_email, msg.as_string())
        return True
    except Exception as e:
        import logging, traceback
        logging.getLogger("kredz").error("Email send failed: %s", e)
        print(f"[Kredz EMAIL ERROR] {type(e).__name__}: {e}")
        traceback.print_exc()
        return False

# ── POST /api/register ────────────────────────────────────────────────
@app.post("/api/register")
async def api_register(student: StudentCreate):
    existing = db_select("students", {"email": student.email})
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Email already registered. Please login instead."
        )

    new_student = db_insert("students", {
        "name":        student.name,
        "institution": student.institution,
        "email":       student.email,
        "password":    student.password
    })

    return {
        "message":    "Registration successful",
        "student_id": new_student["id"],
        "name":       new_student["name"]
    }

# ── POST /api/login ───────────────────────────────────────────────────
@app.post("/api/login")
async def api_login(student: StudentLogin):
    results = db_select("students", {"email": student.email})
    if not results:
        raise HTTPException(
            status_code=401,
            detail="No account found with this email."
        )

    db_student = results[0]

    if db_student["password"] != student.password:
        raise HTTPException(
            status_code=401,
            detail="Incorrect password."
        )

    return {
        "message":     "Login successful",
        "student_id":  db_student["id"],
        "name":        db_student["name"],
        "institution": db_student["institution"]
    }

# ── POST /api/mentor-register ─────────────────────────────────────────
@app.post("/api/mentor-register")
async def api_mentor_register(mentor: MentorCreate):
    existing = db_select("mentors", {"email": mentor.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered.")
    new_mentor = db_insert("mentors", {
        "full_name":   mentor.full_name,
        "institution": mentor.institution,
        "email":       mentor.email,
        "password":    mentor.password,
    })
    return {"message": "Mentor registered", "mentor_id": new_mentor["id"], "full_name": new_mentor["full_name"]}

# ── POST /api/mentor-login ─────────────────────────────────────────────
@app.post("/api/mentor-login")
async def api_mentor_login(mentor: MentorLogin):
    results = db_select("mentors", {"email": mentor.email})
    if not results:
        raise HTTPException(status_code=401, detail="No mentor account found with this email.")
    db_mentor = results[0]
    if db_mentor["password"] != mentor.password:
        raise HTTPException(status_code=401, detail="Incorrect password.")
    return {
        "message":     "Login successful",
        "mentor_id":   db_mentor["id"],
        "full_name":   db_mentor["full_name"],
        "institution": db_mentor["institution"],
        "email":       db_mentor["email"],
    }

# ── GET /api/credential-by-qr-token/{qr_token} ────────────────────────
#
# Called by the frontend when a mentor arrives via a scanned QR link.
# Returns the full credential record + student info + parsed AI verdict.
# The frontend uses this to pre-load and highlight the right credential.
#
@app.get("/api/credential-by-qr-token/{qr_token}")
async def credential_by_qr_token(qr_token: str):
    # qr_token is a prefix of bundle_hash — we stored a separate qr_token column
    results = db_select("credentials", {"qr_token": qr_token})
    if not results:
        raise HTTPException(status_code=404, detail="Credential not found for this QR token.")
    cred = results[0]
    student_results = db_select("students", {"id": cred["student_id"]})
    student = student_results[0] if student_results else {"name": "Unknown", "institution": "Unknown"}

    ai = None
    if cred.get("ai_recommendation"):
        try:
            ai = json.loads(cred["ai_recommendation"])
        except Exception:
            ai = None

    return {
        "credential":  cred,
        "student":     student,
        "ai_verdict":  ai,
    }

# ── GET /api/mentor-credentials ───────────────────────────────────────
#
# Returns all credentials where endorser_email matches the mentor.
#
@app.get("/api/mentor-credentials")
async def mentor_credentials(email: str):
    results = db_select("credentials", {"endorser_email": email})
    enriched = []
    for cred in results:
        student_results = db_select("students", {"id": cred["student_id"]})
        student = student_results[0] if student_results else {"name": "Unknown", "institution": "Unknown"}
        ai = None
        if cred.get("ai_recommendation"):
            try:
                ai = json.loads(cred["ai_recommendation"])
            except Exception:
                pass
        enriched.append({**cred, "student": student, "ai_verdict": ai})
    return enriched

# ── GET /api/dashboard/{student_id} ──────────────────────────────────
@app.get("/api/dashboard/{student_id}")
async def api_dashboard(student_id: int):
    student = db_select("students", {"id": student_id})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    credentials = db_select("credentials", {"student_id": student_id})

    return {
        "student_id":  student_id,
        "name":        student[0]["name"],
        "institution": student[0]["institution"],
        "credentials": credentials
    }

# ── POST /api/submit ──────────────────────────────────────────────────
#
# Now accepts optional file uploads and uses the Hashing module to
# produce a tamper-proof bundle_hash.  The metadata_used dict (which
# contains email_hash + upload_timestamp) is persisted in the DB so
# it can be re-supplied verbatim during verification.
#
@app.post("/api/submit")
async def api_submit(
    student_id:     int                    = Form(...),
    student_name:   str                    = Form(...),
    project_name:   str                    = Form(...),
    type:           str                    = Form(...),
    description:    str                    = Form(...),
    institution:    str                    = Form(...),
    date:           str                    = Form(...),
    email:          EmailStr               = Form(...),
    github_link:    Optional[str]          = Form(None),
    endorser_name:  Optional[str]          = Form(None),
    endorser_email: Optional[str]          = Form(None),
    files:          list[UploadFile]       = File(default=[]),
):
    # ── Validate credential type ──────────────────────────────────────
    if type not in VALID_TYPES:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid type '{type}'. Must be one of: {', '.join(VALID_TYPES)}"
        )

    # ── Verify student exists ─────────────────────────────────────────
    student = db_select("students", {"id": student_id})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    # ── Read uploaded file bytes (fallback: hash metadata as synthetic content) ──
    if files:
        file_contents: list[bytes] = []
        for f in files:
            content = await f.read()
            if content:                  # skip truly empty uploads
                file_contents.append(content)

    # If no real files were uploaded, create a deterministic synthetic
    # "file" from the core credential fields so the hash still covers all
    # submitted data and the module's "at least one file" guard is satisfied.
    if not files or not file_contents:
        synthetic = (
            f"{student_name}|{project_name}|{institution}|{date}|{description}"
        ).encode("utf-8")
        file_contents = [synthetic]

    # ── Build metadata dict for hashing ──────────────────────────────
    metadata = {
        "credential_type": type,
        "project_name":    project_name,
        "student_name":    student_name,
        "institution":     institution,
        "date":            date,
        "description":     description,
    }
    if github_link:
        metadata["github_link"] = github_link

    # ── Generate tamper-proof bundle hash ─────────────────────────────
    try:
        hash_result = generate_bundle_hash(
            file_contents=file_contents,
            metadata=metadata,
            email=email,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    bundle_hash   = hash_result["bundle_hash"]
    qr_token      = hash_result["qr_token"]
    metadata_used = hash_result["metadata_used"]   # MUST be stored as-is

    # ── Duplicate check ───────────────────────────────────────────────
    existing = db_select("credentials", {"credential_hash": bundle_hash})
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Duplicate credential. This exact submission already exists."
        )

    # ── QR code — deep-link straight into the mentor dashboard ──────────
    deep_link    = f"{APP_FRONT_URL}/mentor-verify?token={qr_token}"
    verify_url   = f"{NGROK_URL}/verify/{bundle_hash}"
    qr_filename  = f"{qr_token}.png"
    qr_save_path = str(QR_DIR / qr_filename)
    qrcode.make(deep_link).save(qr_save_path)
    qr_image_url = f"{NGROK_URL}/static/qrcodes/{qr_filename}"

    # ── Endorsement token ─────────────────────────────────────────────
    endorsement_token  = None
    endorsement_status = "none"
    if endorser_email:
        endorsement_token  = secrets.token_urlsafe(32)
        endorsement_status = "pending"

    # ── Persist to Supabase (store qr_token for lookup) ───────────────
    record = db_insert("credentials", {
        "student_id":         student_id,
        "project_name":       project_name,
        "type":               type,
        "description":        description,
        "institution":        institution,
        "date":               date,
        "github_link":        github_link,
        "endorser_name":      endorser_name,
        "endorser_email":     endorser_email,
        "credential_hash":    bundle_hash,
        "qr_token":           qr_token,
        # Store metadata_used as JSON string so verify can reconstruct exactly
        "metadata_used":      json.dumps(metadata_used),
        "endorsement_token":  endorsement_token,
        "endorsement_status": endorsement_status,
        "ai_recommendation":  None
    })

    # ── Fire-and-forget AI verification (non-blocking) ────────────────
    asyncio.create_task(trigger_verification(record["id"]))

    # ── Email QR to mentor ────────────────────────────────────────────
    if endorser_email:
        student_row = db_select("students", {"id": student_id})
        s_name = student_row[0]["name"] if student_row else student_name
        email_ok = send_qr_email(
            endorser_email,
            endorser_name or "Mentor",
            s_name,
            project_name,
            deep_link,
            qr_save_path,
        )
        print(f"[Kredz] Email to {endorser_email}: {'sent ✓' if email_ok else 'FAILED ✗'}")

    return {
        "credential_id":     record["id"],
        "credential_hash":   bundle_hash,
        "qr_token":          qr_token,
        "qr_url":            verify_url,
        "deep_link":         deep_link,
        "qr_image_url":      qr_image_url,
        "endorsement_token": endorsement_token,
        "file_hashes":       hash_result["file_hashes"],
        "locked":            True,
    }

# ── GET /verify/{hash_val} ────────────────────────────────────────────
#
# Uses verify_bundle_hash from the Hashing module instead of a raw
# SHA-256 recompute.  metadata_used is loaded from the DB record and
# passed in verbatim (timestamp already embedded — no regeneration).
#
@app.get("/verify/{hash_val}", response_class=HTMLResponse)
async def verify_page(request: Request, hash_val: str):
    results = db_select("credentials", {"credential_hash": hash_val})
    if not results:
        return templates.TemplateResponse("verify.html", {
            "request": request,
            "status":  "not_found",
            "cred":    None,
            "student": None,
            "ai":      None
        })

    cred = results[0]

    student_results = db_select("students", {"id": cred["student_id"]})
    student = student_results[0] if student_results else {
        "name": "Unknown", "institution": "Unknown"
    }

    # ── Re-derive hash using the Hashing module ───────────────────────
    status = "tampered"   # default; overwritten on valid verify
    try:
        metadata_used_raw = cred.get("metadata_used")
        if metadata_used_raw:
            metadata_used = (
                json.loads(metadata_used_raw)
                if isinstance(metadata_used_raw, str)
                else metadata_used_raw
            )
            # Reconstruct the same synthetic file content used at submit time
            # (we only need this when no real files were stored).
            # Real-file scenarios would require fetching the original bytes
            # from storage — for now we recreate the deterministic synthetic.
            synthetic = (
                f"{student['name']}|{cred['project_name']}|"
                f"{cred['institution']}|{cred['date']}|{cred['description']}"
            ).encode("utf-8")

            email_hash_in_meta = metadata_used.get("email_hash", "")
            # We pass email_hash directly as a dummy email would fail;
            # instead we verify purely on content + metadata (email guard
            # skipped for public verify endpoint — identity check is for
            # owner-only re-verify via POST /api/verify).
            # Temporarily patch metadata to pass the guard:
            patched_meta = dict(metadata_used)
            patched_meta["_bypass_email_check"] = True

            # Use the low-level reconstruction instead:
            import hashlib, hmac as _hmac
            file_hashes = [hashlib.sha256(synthetic).hexdigest()]
            file_hashes.sort()
            payload = {"file_hashes": file_hashes, "metadata": metadata_used}
            canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
            computed  = hashlib.sha256(canonical.encode()).hexdigest()

            if _hmac.compare_digest(computed, hash_val):
                status = "verified"
            else:
                status = "tampered"
        else:
            # Legacy record: fall back to original string hash
            raw        = f"{student['name']}|{cred['project_name']}|{cred['institution']}|{cred['date']}|{cred['description']}"
            recomputed = __import__("hashlib").sha256(raw.encode()).hexdigest()
            status     = "verified" if recomputed == hash_val else "tampered"

    except Exception:
        status = "tampered"

    # ── Parse AI JSON silently ────────────────────────────────────────
    ai = None
    if cred.get("ai_recommendation"):
        try:
            ai = json.loads(cred["ai_recommendation"])
        except Exception:
            ai = None

    return templates.TemplateResponse("verify.html", {
        "request": request,
        "status":  status,
        "cred":    cred,
        "student": student,
        "ai":      ai
    })

# ── POST /api/verify ──────────────────────────────────────────────────
#
# Owner-only endpoint: re-verify a credential using the full
# verify_bundle_hash function (including email identity check).
#
@app.post("/api/verify")
async def api_verify(
    credential_hash: str      = Form(...),
    email:           EmailStr = Form(...),
    files:           list[UploadFile] = File(default=[]),
):
    results = db_select("credentials", {"credential_hash": credential_hash})
    if not results:
        raise HTTPException(status_code=404, detail="Credential not found.")

    cred = results[0]

    metadata_used_raw = cred.get("metadata_used")
    if not metadata_used_raw:
        raise HTTPException(
            status_code=400,
            detail="This credential was created before the hashing module was integrated. "
                   "Use the public /verify/{hash} endpoint instead."
        )

    metadata_used = (
        json.loads(metadata_used_raw)
        if isinstance(metadata_used_raw, str)
        else metadata_used_raw
    )

    # ── Read file bytes (or rebuild synthetic) ────────────────────────
    file_contents: list[bytes] = []
    if files:
        for f in files:
            content = await f.read()
            if content:
                file_contents.append(content)

    if not file_contents:
        student_results = db_select("students", {"id": cred["student_id"]})
        student = student_results[0] if student_results else {"name": "Unknown", "institution": "Unknown"}
        synthetic = (
            f"{student['name']}|{cred['project_name']}|"
            f"{cred['institution']}|{cred['date']}|{cred['description']}"
        ).encode("utf-8")
        file_contents = [synthetic]

    # ── Run cryptographic verification ───────────────────────────────
    valid = verify_bundle_hash(
        file_contents=file_contents,
        metadata_used=metadata_used,
        expected_hash=credential_hash,
        email=email,
    )

    return VerifyHashResponse(
        valid=valid,
        detail="Bundle hash verified — credential is intact." if valid
               else "Hash mismatch or wrong email — credential may have been tampered with.",
        credential_type=cred.get("type") if valid else None,
        owner_email_hash=metadata_used.get("email_hash") if valid else None,
    )

# ── GET /endorse/{token} ──────────────────────────────────────────────
@app.get("/endorse/{token}", response_class=HTMLResponse)
async def endorse_page(request: Request, token: str):
    results = db_select("credentials", {"endorsement_token": token})
    if not results:
        return HTMLResponse(content="""
            <!DOCTYPE html>
            <html>
            <head>
              <title>Kredz — Invalid Link</title>
              <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet"/>
            </head>
            <body class="d-flex align-items-center justify-content-center" style="min-height:100vh; background:#F8FAFC;">
              <div class="text-center p-4">
                <div style="font-size:3rem;">🔗</div>
                <h3 class="mt-3 fw-bold text-danger">Invalid or Expired Link</h3>
                <p class="text-muted">This endorsement link is invalid, already used, or has expired.<br>
                Please contact the student for a new link.</p>
              </div>
            </body>
            </html>
        """, status_code=404)

    cred = results[0]

    student_results = db_select("students", {"id": cred["student_id"]})
    student = student_results[0] if student_results else {
        "name": "Unknown", "institution": "Unknown"
    }

    if cred["endorsement_status"] in ("approved", "rejected"):
        icon = "✅" if cred["endorsement_status"] == "approved" else "❌"
        return HTMLResponse(content=f"""
            <!DOCTYPE html>
            <html>
            <head>
              <title>Kredz — Already Actioned</title>
              <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet"/>
            </head>
            <body class="d-flex align-items-center justify-content-center" style="min-height:100vh; background:#F8FAFC;">
              <div class="text-center p-4">
                <div style="font-size:3rem;">{icon}</div>
                <h3 class="mt-3 fw-bold">Already {cred['endorsement_status'].capitalize()}</h3>
                <p class="text-muted">You have already actioned this credential.<br>
                This link can only be used once.</p>
              </div>
            </body>
            </html>
        """, status_code=200)

    return templates.TemplateResponse("endorse.html", {
        "request": request,
        "cred":    cred,
        "student": student,
        "token":   token
    })

# ── POST /endorse/{token} ─────────────────────────────────────────────
@app.post("/endorse/{token}", response_class=HTMLResponse)
async def api_endorse(token: str, decision: str = Form(...)):
    if decision not in ("approved", "rejected"):
        raise HTTPException(
            status_code=422,
            detail="Decision must be 'approved' or 'rejected'."
        )

    results = db_select("credentials", {"endorsement_token": token})
    if not results:
        raise HTTPException(
            status_code=404,
            detail="Invalid or expired endorsement token."
        )

    cred = results[0]

    db_update(
        "credentials",
        {
            "endorsement_status": decision,
            "endorsed_at":        datetime.now(timezone.utc).isoformat()
        },
        {"endorsement_token": token}
    )

    if decision == "approved":
        icon, title, msg, color = (
            "✅",
            "Credential Approved",
            "You have successfully endorsed this credential. The student has been notified.",
            "#16A34A"
        )
    else:
        icon, title, msg, color = (
            "❌",
            "Credential Rejected",
            "You have rejected this endorsement request. The student will see this status in their portfolio.",
            "#DC2626"
        )

    return HTMLResponse(content=f"""
        <!DOCTYPE html>
        <html>
        <head>
          <title>Kredz — Endorsement {decision.capitalize()}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
          <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet"/>
          <style>
            body {{ background: #F8FAFC; font-family: 'Segoe UI', sans-serif; }}
            .card {{ border: none; border-radius: 20px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }}
          </style>
        </head>
        <body class="d-flex align-items-center justify-content-center" style="min-height:100vh;">
          <div class="card p-5 text-center" style="max-width:420px; width:100%;">
            <div style="font-size:4rem; line-height:1;">{icon}</div>
            <h2 class="mt-3 fw-bold" style="color:{color};">{title}</h2>
            <p class="text-muted mt-2" style="font-size:0.95rem;">{msg}</p>
            <div style="background:#F1F5F9; border-radius:12px; padding:14px;
                        margin-top:20px; font-size:0.82rem; color:#64748B;">
              <strong>Credential:</strong> {cred['project_name']}<br>
              <strong>Type:</strong> {cred['type']}
            </div>
            <p class="mt-4 text-muted" style="font-size:0.8rem;">You may close this tab.</p>
            <div style="margin-top:8px; font-size:0.75rem; color:#94A3B8;">Secured by ⛓ Kredz</div>
          </div>
        </body>
        </html>
    """)

# ── Run directly ──────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

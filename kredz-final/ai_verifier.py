"""
ai_verifier.py — Kredz AI Verification (Groq Free Tier)
=========================================================
Switched from Anthropic Claude → Groq (llama-3.3-70b) which is FREE.

Sign up at https://console.groq.com → API Keys → Create Key
Add GROQ_API_KEY to your Render environment variables.
"""

import json
import logging
import os
import re
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlparse

import httpx
from dotenv import load_dotenv

load_dotenv()

# ── CHANGED: Groq instead of Anthropic ────────────────────────────────
GROQ_API_KEY  = os.getenv("GROQ_API_KEY", "")
GITHUB_TOKEN  = os.getenv("GITHUB_TOKEN", "")
GROQ_URL      = "https://api.groq.com/openai/v1/chat/completions"
GITHUB_API_BASE = "https://api.github.com"
MODEL         = "llama-3.3-70b-versatile"   # Free on Groq
MAX_TOKENS    = 1024

logger = logging.getLogger("kredz.ai")

# ── Prompts ───────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are a strict but fair credential verification AI for Kredz,
a student credential platform used at hackathons.

Your job is to analyse a student's submitted credential — enriched with live
GitHub repository data — and decide whether a mentor should APPROVE or REJECT
it, or whether MANUAL REVIEW is needed.

Rules:
- Be concise. Mentors are busy.
- Flag anything suspicious clearly.
- Never fabricate facts. If you cannot verify something, say so honestly.
- Your output must be valid JSON only — no markdown fences, no preamble.

Output schema (return exactly this):
{
  "verdict":         "approve" | "reject" | "review",
  "confidence":      0-100,
  "integrity_score": 0-100,
  "github": {
    "plagiarism_risk": "low" | "medium" | "high" | "not_provided",
    "issues":          ["list of issues, empty if none"]
  },
  "certificates": {
    "authentic": true | false | null,
    "issues":    ["list of issues, empty if none"]
  },
  "summary": "2-3 sentence plain English summary for the mentor",
  "flags":   ["critical issues only, empty if none"]
}"""


def _build_user_prompt(cred: dict, student: dict, repo_data: Optional[dict]) -> str:
    github_section = _format_github_section(cred.get("github_link"), repo_data)
    cert_section   = _format_certificate_section(cred)

    return f"""Analyse this student credential submission:

STUDENT
  Name:        {student.get('name', 'Unknown')}
  Institution: {student.get('institution', 'Unknown')}

CREDENTIAL
  Project:     {cred.get('project_name', '')}
  Type:        {cred.get('type', '')}
  Description: {cred.get('description', '')}
  Date:        {cred.get('date', '')}
  Institution: {cred.get('institution', '')}
  Endorser:    {cred.get('endorser_name') or 'none'} \
(status: {cred.get('endorsement_status', 'none')})

{github_section}
{cert_section}

CHECK FOR
1. GitHub repo — Does the repo activity match the claimed project scope and date?
   Any signs of template, forked, or empty repos submitted as original work?
2. Certificate integrity — Do the type, date, institution, and description form a
   coherent picture? Flag logical impossibilities.
3. Overall credibility — Is the submission internally consistent?

Return only the JSON schema specified."""


def _format_github_section(github_link: Optional[str], repo_data: Optional[dict]) -> str:
    if not github_link:
        return "GITHUB\n  Not provided."
    if repo_data is None:
        return f"GITHUB\n  URL: {github_link}\n  Metadata: Could not be fetched."
    if "error" in repo_data:
        return f"GITHUB\n  URL: {github_link}\n  Fetch error: {repo_data['error']}"

    lines = [
        "GITHUB REPOSITORY (live data)",
        f"  URL:              {github_link}",
        f"  Name:             {repo_data.get('full_name', 'unknown')}",
        f"  Description:      {repo_data.get('description') or 'none'}",
        f"  Created:          {repo_data.get('created_at', 'unknown')}",
        f"  Last push:        {repo_data.get('pushed_at', 'unknown')}",
        f"  Stars:            {repo_data.get('stargazers_count', 0)}",
        f"  Forks:            {repo_data.get('forks_count', 0)}",
        f"  Is fork:          {repo_data.get('fork', False)}",
        f"  Is template:      {repo_data.get('is_template', False)}",
        f"  Default branch:   {repo_data.get('default_branch', 'unknown')}",
        f"  Open issues:      {repo_data.get('open_issues_count', 0)}",
        f"  Commit count:     {repo_data.get('commit_count', 'unknown')}",
        f"  Contributors:     {repo_data.get('contributor_count', 'unknown')}",
        f"  Languages:        {', '.join(repo_data.get('languages', [])) or 'none detected'}",
        f"  Heuristic flags:  {', '.join(repo_data.get('heuristic_flags', [])) or 'none'}",
    ]
    return "\n".join(lines)


def _format_certificate_section(cred: dict) -> str:
    issues = _check_certificate_consistency(cred)
    lines = ["CERTIFICATE CONSISTENCY CHECK"]
    if issues:
        lines.append(f"  Issues found: {'; '.join(issues)}")
    else:
        lines.append("  No obvious inconsistencies detected.")
    return "\n".join(lines)


# ── GitHub helpers (unchanged) ────────────────────────────────────────

def parse_github_repo(url: str) -> Optional[tuple[str, str]]:
    if not url:
        return None
    try:
        parsed = urlparse(url.strip().rstrip("/"))
        if parsed.netloc not in ("github.com", "www.github.com"):
            return None
        parts = [p for p in parsed.path.split("/") if p]
        if len(parts) < 2:
            return None
        return parts[0], parts[1]
    except Exception:
        return None


async def fetch_repo_data(owner: str, repo: str) -> dict:
    headers = {"Accept": "application/vnd.github+json"}
    if GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"

    base_url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}"

    async with httpx.AsyncClient(timeout=15) as client:
        meta_resp = await client.get(base_url, headers=headers)
        if meta_resp.status_code == 404:
            return {"error": "Repository not found (private or deleted)."}
        if meta_resp.status_code == 403:
            return {"error": "GitHub rate limit exceeded."}
        meta_resp.raise_for_status()
        meta = meta_resp.json()

        commit_count      = await _fetch_commit_count(client, base_url, headers)
        contributor_count = await _fetch_contributor_count(client, base_url, headers)
        languages         = await _fetch_languages(client, base_url, headers)

    result = {
        "full_name":          meta.get("full_name"),
        "description":        meta.get("description"),
        "created_at":         meta.get("created_at"),
        "pushed_at":          meta.get("pushed_at"),
        "stargazers_count":   meta.get("stargazers_count", 0),
        "forks_count":        meta.get("forks_count", 0),
        "fork":               meta.get("fork", False),
        "is_template":        meta.get("is_template", False),
        "default_branch":     meta.get("default_branch", "main"),
        "open_issues_count":  meta.get("open_issues_count", 0),
        "commit_count":       commit_count,
        "contributor_count":  contributor_count,
        "languages":          languages,
    }
    result["heuristic_flags"] = analyze_repo_structure(result)
    return result


async def _fetch_commit_count(client, base_url, headers):
    try:
        resp = await client.get(f"{base_url}/contributors", headers=headers, params={"per_page": 100, "anon": "true"})
        if resp.status_code != 200:
            return None
        contributors = resp.json()
        return sum(c.get("contributions", 0) for c in contributors) if isinstance(contributors, list) else None
    except Exception:
        return None


async def _fetch_contributor_count(client, base_url, headers):
    try:
        resp = await client.get(f"{base_url}/contributors", headers=headers, params={"per_page": 1, "anon": "true"})
        if resp.status_code != 200:
            return None
        link_header = resp.headers.get("Link", "")
        last_match  = re.search(r'page=(\d+)>; rel="last"', link_header)
        if last_match:
            return int(last_match.group(1))
        return len(resp.json()) if isinstance(resp.json(), list) else None
    except Exception:
        return None


async def _fetch_languages(client, base_url, headers):
    try:
        resp = await client.get(f"{base_url}/languages", headers=headers)
        if resp.status_code != 200:
            return []
        data = resp.json()
        return list(data.keys()) if isinstance(data, dict) else []
    except Exception:
        return []


def analyze_repo_structure(repo: dict) -> list[str]:
    flags = []
    commit_count = repo.get("commit_count")
    if commit_count is not None:
        if commit_count == 0:
            flags.append("Empty repository — zero commits.")
        elif commit_count <= 3:
            flags.append(f"Very few commits ({commit_count}) — unlikely to represent a real project.")
    if repo.get("fork"):
        flags.append("Repository is a fork of another project.")
    if repo.get("is_template"):
        flags.append("Repository is marked as a template.")
    if not repo.get("languages"):
        flags.append("No programming languages detected — possibly an empty or docs-only repo.")
    created_at = repo.get("created_at")
    pushed_at  = repo.get("pushed_at")
    if created_at and pushed_at:
        try:
            created  = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            pushed   = datetime.fromisoformat(pushed_at.replace("Z", "+00:00"))
            age_days = (pushed - created).days
            if age_days <= 1:
                flags.append("Repo was created and last pushed on the same day — possible last-minute fabrication.")
        except Exception:
            pass
    if not repo.get("description"):
        flags.append("No repository description provided.")
    return flags


# ── Certificate consistency check (unchanged) ─────────────────────────

def _check_certificate_consistency(cred: dict) -> list[str]:
    issues = []
    cred_type   = (cred.get("type") or "").strip()
    date_str    = (cred.get("date") or "").strip()
    institution = (cred.get("institution") or "").strip()
    description = (cred.get("description") or "").strip()

    if date_str:
        try:
            cred_date = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            now       = datetime.now(timezone.utc)
            if cred_date > now:
                issues.append(f"Credential date '{date_str}' is in the future.")
            if cred_date.year < 2000:
                issues.append(f"Credential date '{date_str}' appears implausibly old.")
        except ValueError:
            issues.append(f"Credential date '{date_str}' is not in a recognisable format.")

    if cred_type == "Internship":
        keywords = ["intern", "company", "organisation", "organization", "work", "role", "position"]
        if description and not any(k in description.lower() for k in keywords):
            issues.append("Internship credential description does not mention expected keywords.")

    if cred_type == "Hackathon":
        keywords = ["hack", "project", "build", "team", "prize", "winner", "submission", "challenge"]
        if description and not any(k in description.lower() for k in keywords):
            issues.append("Hackathon credential description lacks typical hackathon-related language.")

    if not institution:
        issues.append("No issuing institution specified.")

    if description and len(description) < 20:
        issues.append("Description is very short — insufficient detail for verification.")

    return issues


# ── Core AI call — NOW USES GROQ ──────────────────────────────────────

async def run_ai_verification(cred: dict, student: dict) -> dict:
    # ── CHANGED: check Groq key instead of Anthropic ──────────────────
    if not GROQ_API_KEY:
        logger.warning("GROQ_API_KEY not set — AI verification skipped.")
        return _error_result("GROQ_API_KEY not configured.")

    # ── Step 1: Fetch live GitHub data (unchanged) ────────────────────
    repo_data: Optional[dict] = None
    github_url = cred.get("github_link")
    if github_url:
        parsed = parse_github_repo(github_url)
        if parsed:
            owner, repo_name = parsed
            try:
                repo_data = await fetch_repo_data(owner, repo_name)
            except Exception as exc:
                repo_data = {"error": str(exc)}
        else:
            repo_data = {"error": "URL does not appear to be a valid GitHub repository link."}

    # ── Step 2: Call Groq (OpenAI-compatible format) ──────────────────
    payload = {
        "model":      MODEL,
        "max_tokens": MAX_TOKENS,
        "messages":   [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": _build_user_prompt(cred, student, repo_data)}
        ]
    }

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",   # CHANGED
        "Content-Type":  "application/json"
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(GROQ_URL, json=payload, headers=headers)  # CHANGED
            response.raise_for_status()

        # CHANGED: Groq uses OpenAI response format
        raw_text = response.json()["choices"][0]["message"]["content"]
        result   = _safe_parse(raw_text)

        # Merge heuristic flags (unchanged)
        if repo_data and "heuristic_flags" in repo_data:
            existing_issues = result.get("github", {}).get("issues", [])
            merged_issues   = list(dict.fromkeys(existing_issues + repo_data["heuristic_flags"]))
            result.setdefault("github", {})["issues"] = merged_issues

        logger.info("AI verdict for cred %s: %s (score=%s)",
                    cred.get("id"), result.get("verdict"), result.get("integrity_score"))
        return result

    except httpx.HTTPStatusError as e:
        logger.error("Groq API HTTP error: %s", e)
        return _error_result(f"API error: {e.response.status_code}")
    except json.JSONDecodeError as e:
        logger.error("Failed to parse Groq JSON response: %s", e)
        return _error_result("Groq returned malformed JSON.")
    except Exception as e:
        logger.error("AI verification failed: %s", e)
        return _error_result(str(e))


# ── Trigger helper (unchanged) ────────────────────────────────────────

async def trigger_verification(credential_id: int) -> None:
    from database import db_select, db_update

    creds = db_select("credentials", {"id": credential_id})
    if not creds:
        logger.error("trigger_verification: credential %s not found", credential_id)
        return

    cred     = creds[0]
    students = db_select("students", {"id": cred["student_id"]})
    student  = students[0] if students else {"name": "Unknown", "institution": "Unknown"}

    result = await run_ai_verification(cred, student)

    db_update(
        "credentials",
        {"ai_recommendation": json.dumps(result)},
        {"id": credential_id}
    )
    logger.info("Saved AI recommendation for credential %s", credential_id)


# ── Helpers (unchanged) ───────────────────────────────────────────────

def _safe_parse(text: str) -> dict:
    text = text.strip()
    text = re.sub(r"^```(?:json)?", "", text, flags=re.MULTILINE)
    text = re.sub(r"```$",          "", text, flags=re.MULTILINE)
    return json.loads(text.strip())


def _error_result(reason: str) -> dict:
    return {
        "verdict":         "review",
        "confidence":      0,
        "integrity_score": 0,
        "github":          {"plagiarism_risk": "not_provided", "issues": []},
        "certificates":    {"authentic": None, "issues": []},
        "summary":         f"AI verification unavailable: {reason}",
        "flags":           ["AI check failed — manual review required"],
        "error":           reason
    }
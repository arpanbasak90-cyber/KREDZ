"""
ai_verifier.py — Kredz AI Verification Plug-in (Enhanced)
==========================================================
Drop this file next to main.py.

USAGE
-----
1. Call `run_ai_verification(cred, student)` anywhere in your backend.
2. It returns a dict — store it as JSON in credentials.ai_recommendation.
3. Call `trigger_verification(credential_id)` after /api/submit to run async.

INTEGRATION POINTS IN main.py
------------------------------
  Step 1 → Add to imports:
      from ai_verifier import trigger_verification

  Step 2 → At the end of api_submit(), after db_insert, add:
      await trigger_verification(record["id"])

  Step 3 → Done. The verify page already renders the ai field.

NEW: GitHub API is now used to fetch live repository metadata before
     sending the enriched context to Claude for a more accurate verdict.
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

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
GITHUB_TOKEN      = os.getenv("GITHUB_TOKEN", "")          # optional but recommended
ANTHROPIC_URL     = "https://api.anthropic.com/v1/messages"
GITHUB_API_BASE   = "https://api.github.com"
MODEL             = "claude-opus-4-5"
MAX_TOKENS        = 1024

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
    """Build the analysis prompt from credential + student + live GitHub data."""
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


# ── GitHub helpers ────────────────────────────────────────────────────

def parse_github_repo(url: str) -> Optional[tuple[str, str]]:
    """
    Extract (owner, repo) from a GitHub URL.
    Returns None if the URL is not a recognisable GitHub repo URL.
    """
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
    """
    Fetch repository metadata from the GitHub public API.
    Includes commit count, contributor count, and language list.
    """
    headers = {"Accept": "application/vnd.github+json"}
    if GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"

    base_url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}"

    async with httpx.AsyncClient(timeout=15) as client:
        # Core metadata
        meta_resp = await client.get(base_url, headers=headers)
        if meta_resp.status_code == 404:
            return {"error": "Repository not found (private or deleted)."}
        if meta_resp.status_code == 403:
            return {"error": "GitHub rate limit exceeded."}
        meta_resp.raise_for_status()
        meta = meta_resp.json()

        # Commit count via contributors stats (faster than paginating commits)
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


async def _fetch_commit_count(client: httpx.AsyncClient, base_url: str, headers: dict) -> Optional[int]:
    """Fetch total commit count using the contributors endpoint (sum of all commits)."""
    try:
        resp = await client.get(
            f"{base_url}/contributors",
            headers=headers,
            params={"per_page": 100, "anon": "true"}
        )
        if resp.status_code != 200:
            return None
        contributors = resp.json()
        if not isinstance(contributors, list):
            return None
        return sum(c.get("contributions", 0) for c in contributors)
    except Exception:
        return None


async def _fetch_contributor_count(client: httpx.AsyncClient, base_url: str, headers: dict) -> Optional[int]:
    """Fetch the number of contributors."""
    try:
        resp = await client.get(
            f"{base_url}/contributors",
            headers=headers,
            params={"per_page": 1, "anon": "true"}
        )
        if resp.status_code != 200:
            return None
        # Check Link header for total count
        link_header = resp.headers.get("Link", "")
        last_match  = re.search(r'page=(\d+)>; rel="last"', link_header)
        if last_match:
            return int(last_match.group(1))
        # If no pagination, count items in this page
        return len(resp.json()) if isinstance(resp.json(), list) else None
    except Exception:
        return None


async def _fetch_languages(client: httpx.AsyncClient, base_url: str, headers: dict) -> list[str]:
    """Fetch list of languages used in the repo."""
    try:
        resp = await client.get(f"{base_url}/languages", headers=headers)
        if resp.status_code != 200:
            return []
        data = resp.json()
        return list(data.keys()) if isinstance(data, dict) else []
    except Exception:
        return []


def analyze_repo_structure(repo: dict) -> list[str]:
    """
    Apply heuristic rules to detect suspicious patterns.
    Returns a list of flag strings.
    """
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
            created = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            pushed  = datetime.fromisoformat(pushed_at.replace("Z", "+00:00"))
            age_days = (pushed - created).days
            if age_days <= 1:
                flags.append("Repo was created and last pushed on the same day — possible last-minute fabrication.")
        except Exception:
            pass

    contributor_count = repo.get("contributor_count")
    if contributor_count is not None and contributor_count == 1:
        # Not a flag on its own — solo projects are common — but log it.
        pass  # leave for Claude to assess in context

    if not repo.get("description"):
        flags.append("No repository description provided.")

    return flags


# ── Certificate consistency check ─────────────────────────────────────

def _check_certificate_consistency(cred: dict) -> list[str]:
    """
    Perform lightweight logical consistency checks on the credential fields.
    Returns a list of issue strings (empty = no issues found).
    """
    issues = []
    cred_type   = (cred.get("type") or "").strip()
    date_str    = (cred.get("date") or "").strip()
    institution = (cred.get("institution") or "").strip()
    description = (cred.get("description") or "").strip()

    # Date sanity check
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

    # Type-specific checks
    if cred_type == "Internship":
        keywords = ["intern", "company", "organisation", "organization", "work", "role", "position"]
        if description and not any(k in description.lower() for k in keywords):
            issues.append("Internship credential description does not mention expected keywords (role, company, etc.).")

    if cred_type == "Hackathon":
        keywords = ["hack", "project", "build", "team", "prize", "winner", "submission", "challenge"]
        if description and not any(k in description.lower() for k in keywords):
            issues.append("Hackathon credential description lacks typical hackathon-related language.")

    # Empty institution
    if not institution:
        issues.append("No issuing institution specified.")

    # Description too short
    if description and len(description) < 20:
        issues.append("Description is very short — insufficient detail for verification.")

    return issues


# ── Core AI call ──────────────────────────────────────────────────────

async def run_ai_verification(cred: dict, student: dict) -> dict:
    """
    Analyse a credential and return a structured verdict dict.

    Parameters
    ----------
    cred    : row from the credentials table
    student : row from the students table

    Returns
    -------
    dict matching the schema above, or an error dict if the call fails.
    """
    if not ANTHROPIC_API_KEY:
        logger.warning("ANTHROPIC_API_KEY not set — AI verification skipped.")
        return _error_result("ANTHROPIC_API_KEY not configured.")

    # ── Step 1: Fetch live GitHub data ────────────────────────────────
    repo_data: Optional[dict] = None
    github_url = cred.get("github_link")
    if github_url:
        parsed = parse_github_repo(github_url)
        if parsed:
            owner, repo_name = parsed
            try:
                repo_data = await fetch_repo_data(owner, repo_name)
                logger.info("Fetched GitHub data for %s/%s", owner, repo_name)
            except Exception as exc:
                logger.warning("GitHub fetch failed for %s: %s", github_url, exc)
                repo_data = {"error": str(exc)}
        else:
            repo_data = {"error": "URL does not appear to be a valid GitHub repository link."}

    # ── Step 2: Build prompt and call Claude ──────────────────────────
    payload = {
        "model":      MODEL,
        "max_tokens": MAX_TOKENS,
        "system":     SYSTEM_PROMPT,
        "messages":   [
            {"role": "user", "content": _build_user_prompt(cred, student, repo_data)}
        ]
    }

    headers = {
        "x-api-key":         ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type":      "application/json"
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(ANTHROPIC_URL, json=payload, headers=headers)
            response.raise_for_status()

        raw_text = response.json()["content"][0]["text"]
        result   = _safe_parse(raw_text)

        # ── Step 3: Merge heuristic flags into result ─────────────────
        if repo_data and "heuristic_flags" in repo_data:
            existing_issues = result.get("github", {}).get("issues", [])
            merged_issues   = list(dict.fromkeys(existing_issues + repo_data["heuristic_flags"]))
            result.setdefault("github", {})["issues"] = merged_issues

        logger.info(
            "AI verdict for cred %s: %s (score=%s)",
            cred.get("id"), result.get("verdict"), result.get("integrity_score")
        )
        return result

    except httpx.HTTPStatusError as e:
        logger.error("Anthropic API HTTP error: %s", e)
        return _error_result(f"API error: {e.response.status_code}")
    except json.JSONDecodeError as e:
        logger.error("Failed to parse Claude JSON response: %s", e)
        return _error_result("Claude returned malformed JSON.")
    except Exception as e:
        logger.error("AI verification failed: %s", e)
        return _error_result(str(e))


# ── Trigger helper (call this from main.py) ───────────────────────────

async def trigger_verification(credential_id: int) -> None:
    """
    Fetch the credential + student from the DB, run AI verification,
    and save the result back to credentials.ai_recommendation.

    Call this at the end of api_submit() in main.py:

        await trigger_verification(record["id"])
    """
    from database import db_select, db_update  # avoid circular imports

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


# ── Helpers ───────────────────────────────────────────────────────────

def _safe_parse(text: str) -> dict:
    """Strip any accidental markdown fences and parse JSON."""
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

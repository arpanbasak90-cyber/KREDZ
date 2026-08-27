import os
import httpx
from dotenv import load_dotenv
from fastapi import HTTPException

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

HEADERS = {
    "apikey":        SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type":  "application/json",
    "Prefer":        "return=representation"
}

def db_insert(table: str, data: dict) -> dict:
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    response = httpx.post(url, json=data, headers=HEADERS)
    if response.status_code not in (200, 201):
        raise HTTPException(status_code=400, detail=f"DB Insert failed: {response.text}")
    result = response.json()
    return result[0] if isinstance(result, list) else result

def db_select(table: str, filters: dict = None) -> list:
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    params = {"select": "*"}
    if filters:
        params.update({f"{k}": f"eq.{v}" for k, v in filters.items()})
    response = httpx.get(url, params=params, headers=HEADERS)
    if response.status_code != 200:
        raise HTTPException(status_code=400, detail=f"DB Select failed: {response.text}")
    return response.json()

def db_update(table: str, data: dict, filters: dict) -> dict:
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    params = {f"{k}": f"eq.{v}" for k, v in filters.items()}
    response = httpx.patch(url, json=data, params=params, headers=HEADERS)
    if response.status_code not in (200, 204):
        raise HTTPException(status_code=400, detail=f"DB Update failed: {response.text}")
    result = response.json()
    return result[0] if isinstance(result, list) and result else {}
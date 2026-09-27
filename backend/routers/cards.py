from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from functools import lru_cache
from urllib.parse import quote
import httpx
import json
import os

from google import genai
from google.genai import types as genai_types
from google.genai import errors as genai_errors
from pydantic import BaseModel

from database import get_db
import models
import schemas

router = APIRouter()


# --- Idiom lookup via Google Gemini (free tier) ------------------------------
# The Free Dictionary / Datamuse / Wiktionary APIs are keyed on dictionary
# entries and 404 on most multi-word idioms ("ice in the veins", "break a
# leg"), so idioms are resolved through Gemini instead — it defines any genuine
# idiom and writes a natural example. The free tier needs only a free API key
# (GEMINI_API_KEY), no billing.

IDIOM_MODEL = "gemini-2.5-flash"

IDIOM_SYSTEM = (
    "You are a precise English-idiom dictionary for a flashcard app. "
    "Given a phrase, decide whether it is a genuine English idiom or fixed "
    "figurative expression (e.g. \"ice in the veins\", \"spill the beans\", "
    "\"under the weather\").\n\n"
    "If it is, set found=true and fill every field:\n"
    "- idiom: the canonical dictionary form of the phrase\n"
    "- meaning: one concise sentence, no leading \"It means\"\n"
    "- example: one natural sentence that uses the idiom in context\n"
    "- formality: exactly one of Informal, Neutral, or Formal\n"
    "- related: 0-3 related idioms as a comma-separated string (may be empty)\n\n"
    "If the phrase is not a real idiom — a single literal word, random words, "
    "or gibberish — set found=false and leave the other fields as empty strings."
)


class IdiomResult(BaseModel):
    found: bool
    idiom: str = ""
    meaning: str = ""
    example: str = ""
    formality: str = ""
    related: str = ""


@lru_cache(maxsize=1)
def _gemini_client() -> genai.Client:
    # Cached so the HTTP client is reused across requests. Reads GEMINI_API_KEY.
    return genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# Local JLPT vocab fallback (~14k words, kanji and kana keyed)
_JLPT_DATA_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "jlpt_vocab.json")
try:
    with open(_JLPT_DATA_PATH, encoding="utf-8") as _f:
        _JLPT_LOOKUP: dict[str, str] = json.load(_f)
except Exception:
    _JLPT_LOOKUP = {}


def _local_jlpt(word: str, reading: str) -> str:
    return (
        _JLPT_LOOKUP.get(word)
        or _JLPT_LOOKUP.get(reading)
        or "Unknown"
    )


NOT_FOUND = {"found": False}


async def _fetch_json(url: str, params: Optional[dict] = None):
    """GET and decode JSON, or None if the upstream can't be used.

    These lookups only pre-fill a form the user can complete by hand, so an
    upstream that is down, slow, or returning an error page should degrade to
    "not found" rather than failing the request.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, params=params)
        if response.status_code != 200:
            return None
        return response.json()
    except httpx.HTTPError:
        # Timeouts, DNS failures, refused connections, protocol errors.
        return None
    except ValueError:
        # Body wasn't JSON — json.JSONDecodeError subclasses ValueError.
        return None


def _first_dict(value) -> dict:
    """First usable mapping in what should be a list of them."""
    if isinstance(value, list):
        for item in value:
            if isinstance(item, dict):
                return item
    return {}


def _strings(value) -> List[str]:
    return [item for item in value if isinstance(item, str)] if isinstance(value, list) else []


@router.get("/lookup/{word}")
async def lookup_word(word: str):
    data = await _fetch_json(
        "https://jisho.org/api/v1/search/words", params={"keyword": word}
    )
    if not isinstance(data, dict):
        return NOT_FOUND

    entry = _first_dict(data.get("data"))
    if not entry:
        return NOT_FOUND

    japanese = _first_dict(entry.get("japanese"))
    senses = _first_dict(entry.get("senses"))

    reading = japanese.get("reading") or ""
    if not isinstance(reading, str):
        reading = ""
    definitions = _strings(senses.get("english_definitions"))

    # An entry carrying neither a reading nor a definition would fill nothing
    # in, so report it as a miss rather than a successful empty lookup.
    if not reading and not definitions:
        return NOT_FOUND

    # Prefer Jisho's JLPT tag; fall back to the local word list.
    jlpt_tags = _strings(entry.get("jlpt"))
    jlpt_level = (
        jlpt_tags[0].replace("jlpt-", "").upper()
        if jlpt_tags
        else _local_jlpt(word, reading)
    )

    return {
        "found": True,
        "furigana": reading,
        "english": ", ".join(definitions),
        "parts_of_speech": _strings(senses.get("parts_of_speech")),
        "jlpt_level": jlpt_level,
    }


DICTIONARY_API = "https://api.dictionaryapi.dev/api/v2/entries/en/"


@router.get("/english-lookup/{word}")
async def lookup_english_word(word: str):
    # The word is a path segment upstream, not a query parameter, so it needs
    # percent-encoding rather than params=. safe="" encodes "/" too: pasted
    # straight in, a word like "../../health" resolves away the API path and
    # sends the request somewhere else on the host entirely.
    data = await _fetch_json(DICTIONARY_API + quote(word.strip(), safe=""))

    entry = _first_dict(data)
    if not entry:
        return NOT_FOUND

    phonetic = entry.get("phonetic", "")
    if not phonetic:
        for p in entry.get("phonetics", []) or []:
            if isinstance(p, dict) and p.get("text"):
                phonetic = p["text"]
                break

    definition = ""
    example = ""
    synonyms: list[str] = []
    part_of_speech = ""

    for meaning in entry.get("meanings", []) or []:
        if not isinstance(meaning, dict):
            continue
        if not part_of_speech:
            part_of_speech = meaning.get("partOfSpeech", "")
        for defn in meaning.get("definitions", []) or []:
            if not isinstance(defn, dict):
                continue
            if not definition:
                definition = defn.get("definition", "")
            if not example:
                example = defn.get("example", "")
        synonyms.extend(_strings(meaning.get("synonyms")))

    return {
        "found": True,
        "word": entry.get("word", word),
        "phonetic": phonetic,
        "definition": definition,
        "example": example,
        "synonyms": ", ".join(synonyms[:5]),
        "part_of_speech": part_of_speech,
    }


@router.get("/idiom-lookup/{idiom}", response_model=IdiomResult)
async def lookup_idiom(idiom: str):
    if not os.getenv("GEMINI_API_KEY"):
        raise HTTPException(
            status_code=503,
            detail="Idiom lookup is unavailable — set GEMINI_API_KEY in backend/.env.",
        )

    try:
        response = await _gemini_client().aio.models.generate_content(
            model=IDIOM_MODEL,
            contents=idiom.strip(),
            config=genai_types.GenerateContentConfig(
                system_instruction=IDIOM_SYSTEM,
                response_mime_type="application/json",
                response_schema=IdiomResult,
                # Simple extraction — disable the model's thinking step for a
                # fast, cheap lookup.
                thinking_config=genai_types.ThinkingConfig(thinking_budget=0),
            ),
        )
    except genai_errors.ClientError as e:
        # 4xx — bad/expired key, quota exhausted, no model access. These are
        # configuration problems the user must fix, so surface the message
        # rather than masquerading as "idiom not found".
        raise HTTPException(status_code=503, detail=f"Idiom lookup failed — {e.message}")
    except genai_errors.APIError:
        # Server-side / transient — let the form fall back to manual entry.
        return IdiomResult(found=False)

    # response.parsed is the validated IdiomResult (None if the model returned
    # nothing parseable).
    return response.parsed or IdiomResult(found=False)


@router.get("/", response_model=List[schemas.CardResponse])
def get_cards(
    jlpt_level: Optional[str] = None,
    card_type: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(models.Card)
    if jlpt_level:
        query = query.filter(models.Card.jlpt_level == jlpt_level)
    if card_type:
        query = query.filter(models.Card.card_type == card_type)
    return query.order_by(models.Card.created_at.desc()).all()


@router.post("/", response_model=schemas.CardResponse)
def create_card(card: schemas.CardCreate, db: Session = Depends(get_db)):
    db_card = models.Card(**card.model_dump())
    db.add(db_card)
    db.flush()
    db_review = models.Review(card_id=db_card.id)
    db.add(db_review)
    db.commit()
    db.refresh(db_card)
    return db_card


@router.get("/{card_id}", response_model=schemas.CardResponse)
def get_card(card_id: int, db: Session = Depends(get_db)):
    card = db.query(models.Card).filter(models.Card.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    return card


@router.put("/{card_id}", response_model=schemas.CardResponse)
def update_card(card_id: int, card: schemas.CardCreate, db: Session = Depends(get_db)):
    db_card = db.query(models.Card).filter(models.Card.id == card_id).first()
    if not db_card:
        raise HTTPException(status_code=404, detail="Card not found")
    for key, value in card.model_dump().items():
        setattr(db_card, key, value)
    db.commit()
    db.refresh(db_card)
    return db_card


@router.put("/{card_id}/note", response_model=schemas.CardResponse)
def update_card_note(
    card_id: int, payload: schemas.CardNoteUpdate, db: Session = Depends(get_db)
):
    db_card = db.query(models.Card).filter(models.Card.id == card_id).first()
    if not db_card:
        raise HTTPException(status_code=404, detail="Card not found")
    db_card.note = payload.note
    db.commit()
    db.refresh(db_card)
    return db_card


@router.delete("/{card_id}")
def delete_card(card_id: int, db: Session = Depends(get_db)):
    db_card = db.query(models.Card).filter(models.Card.id == card_id).first()
    if not db_card:
        raise HTTPException(status_code=404, detail="Card not found")
    db.delete(db_card)
    db.commit()
    return {"message": "deleted"}

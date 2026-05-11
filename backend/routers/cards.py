from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
import httpx

from database import get_db
import models
import schemas

router = APIRouter()


@router.get("/lookup/{word}")
async def lookup_word(word: str):
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            f"https://jisho.org/api/v1/search/words",
            params={"keyword": word},
        )
        data = response.json()

    if not data.get("data"):
        return {"found": False}

    entry = data["data"][0]
    japanese = entry["japanese"][0]
    senses = entry["senses"][0]

    jlpt_tags = [t for t in entry.get("tags", []) if t.startswith("jlpt-")]
    jlpt_level = jlpt_tags[0].replace("jlpt-", "").upper() if jlpt_tags else "Unknown"

    return {
        "found": True,
        "furigana": japanese.get("reading", ""),
        "english": ", ".join(senses["english_definitions"]),
        "parts_of_speech": senses.get("parts_of_speech", []),
        "jlpt_level": jlpt_level,
    }


@router.get("/english-lookup/{word}")
async def lookup_english_word(word: str):
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            f"https://api.dictionaryapi.dev/api/v2/entries/en/{word}"
        )
    if response.status_code != 200:
        return {"found": False}

    data = response.json()
    if not data or not isinstance(data, list):
        return {"found": False}

    entry = data[0]
    phonetic = entry.get("phonetic", "")
    if not phonetic:
        for p in entry.get("phonetics", []):
            if p.get("text"):
                phonetic = p["text"]
                break

    definition = ""
    example = ""
    synonyms: list[str] = []
    part_of_speech = ""

    for meaning in entry.get("meanings", []):
        if not part_of_speech:
            part_of_speech = meaning.get("partOfSpeech", "")
        for defn in meaning.get("definitions", []):
            if not definition:
                definition = defn.get("definition", "")
            if not example:
                example = defn.get("example", "")
        synonyms.extend(meaning.get("synonyms", []))

    return {
        "found": True,
        "word": entry.get("word", word),
        "phonetic": phonetic,
        "definition": definition,
        "example": example,
        "synonyms": ", ".join(synonyms[:5]),
        "part_of_speech": part_of_speech,
    }


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


@router.delete("/{card_id}")
def delete_card(card_id: int, db: Session = Depends(get_db)):
    db_card = db.query(models.Card).filter(models.Card.id == card_id).first()
    if not db_card:
        raise HTTPException(status_code=404, detail="Card not found")
    db.delete(db_card)
    db.commit()
    return {"message": "deleted"}

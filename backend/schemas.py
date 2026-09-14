from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class CardCreate(BaseModel):
    card_type: Optional[str] = "japanese"
    japanese: str
    furigana: Optional[str] = ""
    english: Optional[str] = ""
    example_sentence: Optional[str] = ""
    synonym: Optional[str] = ""
    jlpt_level: Optional[str] = "Unknown"


class CardResponse(CardCreate):
    id: int
    note: Optional[str] = ""
    created_at: datetime

    model_config = {"from_attributes": True}


class DueCardResponse(CardResponse):
    # Days until the next review for each rating button (keyed by SM-2 quality),
    # computed from this card's live review state. Lets the Study page label the
    # buttons with real numbers instead of fixed guesses.
    next_intervals: dict[int, int] = {}


class CardNoteUpdate(BaseModel):
    note: str


class ReviewCreate(BaseModel):
    card_id: int
    quality: int   # 0–5 (SM-2 scale)


class ReviewResponse(BaseModel):
    id: int
    card_id: int
    ease_factor: float
    interval: int
    repetitions: int
    next_review: datetime
    last_reviewed: Optional[datetime] = None
    learned_at: Optional[datetime] = None

    model_config = {"from_attributes": True}

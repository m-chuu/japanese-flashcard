from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class CardCreate(BaseModel):
    japanese: str
    furigana: Optional[str] = ""
    english: Optional[str] = ""
    example_sentence: Optional[str] = ""
    synonym: Optional[str] = ""
    jlpt_level: Optional[str] = "Unknown"


class CardResponse(CardCreate):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}


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

    model_config = {"from_attributes": True}

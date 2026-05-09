from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from database import get_db
import models
import schemas
from srs import sm2

router = APIRouter()


@router.get("/due", response_model=List[schemas.CardResponse])
def get_due_cards(db: Session = Depends(get_db)):
    now = datetime.utcnow()
    due_reviews = (
        db.query(models.Review)
        .filter(models.Review.next_review <= now)
        .all()
    )
    card_ids = [r.card_id for r in due_reviews]
    return db.query(models.Card).filter(models.Card.id.in_(card_ids)).all()


@router.post("/", response_model=schemas.ReviewResponse)
def submit_review(review: schemas.ReviewCreate, db: Session = Depends(get_db)):
    db_review = (
        db.query(models.Review)
        .filter(models.Review.card_id == review.card_id)
        .first()
    )
    if not db_review:
        raise HTTPException(status_code=404, detail="Review record not found")

    new_ef, new_interval, new_reps, next_review = sm2(
        review.quality,
        db_review.ease_factor,
        db_review.interval,
        db_review.repetitions,
    )

    db_review.ease_factor = new_ef
    db_review.interval = new_interval
    db_review.repetitions = new_reps
    db_review.next_review = next_review
    db_review.last_reviewed = datetime.utcnow()
    db.commit()
    db.refresh(db_review)
    return db_review

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, date, timedelta

from database import get_db
import models
import schemas
from srs import sm2

router = APIRouter()


@router.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    total_cards = db.query(func.count(models.Card.id)).scalar() or 0

    now = datetime.utcnow()
    due_today = db.query(func.count(models.Review.id)).filter(
        models.Review.next_review <= now
    ).scalar() or 0

    mastered = db.query(func.count(models.Review.id)).filter(
        models.Review.interval >= 21
    ).scalar() or 0

    reviewed_dates_raw = (
        db.query(func.date(models.Review.last_reviewed))
        .filter(models.Review.last_reviewed.isnot(None))
        .distinct()
        .all()
    )

    parsed_dates = sorted(
        {d[0] for d in reviewed_dates_raw if d[0] is not None},
        reverse=True,
    )

    streak = 0
    today = date.today()
    check = today

    if parsed_dates and parsed_dates[0] != today:
        check = today - timedelta(days=1)

    for d in parsed_dates:
        if d == check:
            streak += 1
            check -= timedelta(days=1)
        elif d < check:
            break

    return {
        "total_cards": total_cards,
        "due_today": due_today,
        "mastered": mastered,
        "streak": streak,
    }


@router.get("/n1-progress")
def get_n1_progress(db: Session = Depends(get_db)):
    now = datetime.utcnow()
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow = today + timedelta(days=1)

    total = db.query(func.count(models.Card.id)).filter(
        models.Card.jlpt_level == "N1"
    ).scalar() or 0

    unlocked = (
        db.query(func.count(models.Review.id))
        .join(models.Card, models.Card.id == models.Review.card_id)
        .filter(models.Card.jlpt_level == "N1", models.Review.next_review <= now)
        .scalar() or 0
    )

    mastered = (
        db.query(func.count(models.Review.id))
        .join(models.Card, models.Card.id == models.Review.card_id)
        .filter(models.Card.jlpt_level == "N1", models.Review.interval >= 21)
        .scalar() or 0
    )

    due_today = (
        db.query(func.count(models.Review.id))
        .join(models.Card, models.Card.id == models.Review.card_id)
        .filter(models.Card.jlpt_level == "N1", models.Review.next_review <= now)
        .scalar() or 0
    )

    # Today's brand-new words (unlocked today, never reviewed)
    todays_new = (
        db.query(models.Card)
        .join(models.Review, models.Card.id == models.Review.card_id)
        .filter(
            models.Card.jlpt_level == "N1",
            models.Review.next_review >= today,
            models.Review.next_review < tomorrow,
            models.Review.repetitions == 0,
        )
        .all()
    )

    # Upcoming 7 days of new words
    upcoming = []
    for offset in range(1, 8):
        day_start = today + timedelta(days=offset)
        day_end = day_start + timedelta(days=1)
        count = (
            db.query(func.count(models.Review.id))
            .join(models.Card, models.Card.id == models.Review.card_id)
            .filter(
                models.Card.jlpt_level == "N1",
                models.Review.next_review >= day_start,
                models.Review.next_review < day_end,
                models.Review.repetitions == 0,
            )
            .scalar() or 0
        )
        upcoming.append({"day_offset": offset, "new_words": count})

    # Determine current day in schedule
    earliest = (
        db.query(func.min(models.Review.next_review))
        .join(models.Card, models.Card.id == models.Review.card_id)
        .filter(models.Card.jlpt_level == "N1")
        .scalar()
    )
    current_day = 0
    if earliest:
        start = earliest.replace(hour=0, minute=0, second=0, microsecond=0)
        current_day = max(1, (today - start).days + 1)

    total_days = (total + 9) // 10

    return {
        "total": total,
        "unlocked": unlocked,
        "locked": total - unlocked,
        "mastered": mastered,
        "due_today": due_today,
        "current_day": current_day,
        "total_days": total_days,
        "todays_new_words": [
            {"id": c.id, "japanese": c.japanese, "furigana": c.furigana, "english": c.english}
            for c in todays_new
        ],
        "upcoming": upcoming,
    }


@router.get("/due", response_model=List[schemas.CardResponse])
def get_due_cards(
    card_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    now = datetime.utcnow()
    due_reviews = (
        db.query(models.Review)
        .filter(models.Review.next_review <= now)
        .all()
    )
    card_ids = [r.card_id for r in due_reviews]
    query = db.query(models.Card).filter(models.Card.id.in_(card_ids))
    if card_type:
        query = query.filter(models.Card.card_type == card_type)
    return query.all()


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

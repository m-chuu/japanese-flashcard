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

    n1_cards = db.query(models.Card).filter(models.Card.jlpt_level == "N1")
    total = n1_cards.count()

    n1_reviews = (
        db.query(models.Review)
        .join(models.Card, models.Card.id == models.Review.card_id)
        .filter(models.Card.jlpt_level == "N1")
    )

    # Unlocked = introduced to the user: either initial unlock date has passed
    # (next_review <= now and never touched) or the card has been reviewed at
    # least once (repetitions > 0). The previous `next_review <= now` check
    # alone made reviewed cards re-appear as locked after SM-2 pushed them out.
    unlocked = n1_reviews.filter(
        (models.Review.repetitions > 0) | (models.Review.next_review <= now)
    ).count()

    due_today = n1_reviews.filter(models.Review.next_review <= now).count()

    # Mastered mirrors /learned (Review.last_reviewed IS NOT NULL) so the two
    # pages stay consistent — marking an N1 card learned counts it as mastered.
    mastered = n1_reviews.filter(models.Review.last_reviewed.isnot(None)).count()

    # Schedule start anchored to the earliest N1 card's created_at — stable
    # across SM-2 reviews (unlike min(next_review), which moves when cards
    # advance).
    earliest = (
        db.query(func.min(models.Card.created_at))
        .filter(models.Card.jlpt_level == "N1")
        .scalar()
    )
    current_day = 0
    if earliest:
        start = earliest.replace(hour=0, minute=0, second=0, microsecond=0)
        current_day = max(1, (today - start).days + 1)

    total_days = (total + 9) // 10

    # Today's batch is the 10 cards seeded for current_day (id order matches
    # seed batch order). Using id-slice instead of next_review keeps the list
    # stable as the user grades cards through the day.
    batch_start = max(0, (current_day - 1) * 10)
    todays_new = (
        n1_cards.order_by(models.Card.id)
        .offset(batch_start)
        .limit(10)
        .all()
    )

    upcoming = []
    for offset in range(1, 8):
        day_index = current_day + offset
        remaining = total - (day_index - 1) * 10 if day_index <= total_days else 0
        upcoming.append({
            "day_offset": offset,
            "new_words": max(0, min(10, remaining)),
        })

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
        .filter(
            models.Review.next_review <= now,
            models.Review.last_reviewed.is_(None),
        )
        .all()
    )
    card_ids = [r.card_id for r in due_reviews]
    query = db.query(models.Card).filter(models.Card.id.in_(card_ids))
    if card_type:
        query = query.filter(models.Card.card_type == card_type)
    return query.all()


@router.get("/learned/summary")
def get_learned_summary(db: Session = Depends(get_db)):
    rows = (
        db.query(models.Card.jlpt_level, func.count(models.Review.id))
        .join(models.Review, models.Review.card_id == models.Card.id)
        .filter(models.Review.last_reviewed.isnot(None))
        .group_by(models.Card.jlpt_level)
        .all()
    )
    by_level = {level: count for level, count in rows}
    levels = ["N5", "N4", "N3", "N2", "N1", "Unknown"]
    breakdown = [{"jlpt_level": lvl, "count": by_level.get(lvl, 0)} for lvl in levels]
    total = sum(item["count"] for item in breakdown)
    return {"total": total, "by_level": breakdown}


@router.get("/learned/words", response_model=List[schemas.CardResponse])
def get_learned_words(
    jlpt_level: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = (
        db.query(models.Card)
        .join(models.Review, models.Review.card_id == models.Card.id)
        .filter(models.Review.last_reviewed.isnot(None))
    )
    if jlpt_level:
        query = query.filter(models.Card.jlpt_level == jlpt_level)
    return query.order_by(models.Review.last_reviewed.desc()).all()


@router.post("/learned/{card_id}/unmark")
def unmark_learned(card_id: int, db: Session = Depends(get_db)):
    db_review = (
        db.query(models.Review)
        .filter(models.Review.card_id == card_id)
        .first()
    )
    if not db_review:
        raise HTTPException(status_code=404, detail="Review record not found")

    db_review.ease_factor = 2.5
    db_review.interval = 1
    db_review.repetitions = 0
    db_review.last_reviewed = None
    db_review.next_review = datetime.utcnow()
    db.commit()
    return {"ok": True, "card_id": card_id}


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

import os
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, date, timedelta, timezone, tzinfo
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from database import get_db
import models
import schemas
from srs import sm2

# New words introduced per calendar day, per deck. Backlog beyond this rolls
# to the next day(s) — keeps a 30-card pile-up from becoming a 30-card session.
DAILY_NEW_LIMIT = 10

# Ceiling on repeat reviews in one session. Unlike new words this is a soft
# per-session cap, not a daily quota: graded cards reschedule into the future,
# so a backlog drains on its own rather than rolling over.
DAILY_REVIEW_LIMIT = 50

router = APIRouter()


# Timestamps are stored as naive UTC (datetime.utcnow), but "today" is a
# question about where the user actually is: for a Tokyo learner, a 07:00
# session happened at 22:00 UTC *yesterday*. Bucketing by UTC date would push
# every morning review onto the previous day, breaking streaks and resetting
# the new-word quota mid-morning. Set APP_TIMEZONE (e.g. Asia/Tokyo) to the
# zone you study in; it defaults to the server's local zone.
def _app_zone() -> tzinfo:
    name = os.getenv("APP_TIMEZONE")
    if name:
        try:
            return ZoneInfo(name)
        except (ZoneInfoNotFoundError, ValueError):
            # A typo shouldn't take down the Home page — fall back to local.
            pass
    local = datetime.now().astimezone().tzinfo
    return local or timezone.utc


def _to_local_date(stored: datetime, zone: tzinfo) -> date:
    """Calendar day a stored (naive UTC) timestamp falls on, in `zone`."""
    return stored.replace(tzinfo=timezone.utc).astimezone(zone).date()


def _local_day_start(zone: tzinfo) -> datetime:
    """Midnight today in `zone`, as naive UTC for comparing against columns."""
    local_midnight = datetime.now(zone).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    return local_midnight.astimezone(timezone.utc).replace(tzinfo=None)


def _new_word_allowance(db: Session, card_type: Optional[str] = None) -> int:
    """Slots left in today's new-word budget for a deck.

    Counted from learned_at rather than per request, so refreshing the Study
    page cannot pull tomorrow's batch forward. The day rolls over at local
    midnight in the study timezone, matching the streak. The budget is per deck and is
    shared across JLPT levels — studying N5 words spends the same allowance an
    N1 session draws on.
    """
    day_start = _local_day_start(_app_zone())
    query = (
        db.query(func.count(models.Review.id))
        .join(models.Card, models.Card.id == models.Review.card_id)
        .filter(models.Review.learned_at >= day_start)
    )
    if card_type:
        query = query.filter(models.Card.card_type == card_type)
    return max(0, DAILY_NEW_LIMIT - (query.scalar() or 0))


def _due(db: Session, card_type: Optional[str], jlpt_level: Optional[str]):
    query = (
        db.query(models.Card)
        .join(models.Review, models.Review.card_id == models.Card.id)
        .filter(models.Review.next_review <= datetime.utcnow())
    )
    if card_type:
        query = query.filter(models.Card.card_type == card_type)
    if jlpt_level:
        query = query.filter(models.Card.jlpt_level == jlpt_level)
    return query


def _due_repeats(
    db: Session, card_type: Optional[str] = None, jlpt_level: Optional[str] = None
) -> List[models.Card]:
    """Already-studied cards whose SM-2 interval has elapsed."""
    return (
        _due(db, card_type, jlpt_level)
        .filter(models.Review.learned_at.isnot(None))
        # Oldest-scheduled first so a backlog drains in the order it built up.
        .order_by(models.Review.next_review.asc())
        .limit(DAILY_REVIEW_LIMIT)
        .all()
    )


def _new_words(
    db: Session, card_type: Optional[str] = None, jlpt_level: Optional[str] = None
) -> List[models.Card]:
    """Never-studied cards unlocked today, within the daily new-word budget."""
    allowance = _new_word_allowance(db, card_type)
    if not allowance:
        return []
    return (
        _due(db, card_type, jlpt_level)
        .filter(models.Review.learned_at.is_(None))
        # Card.id tiebreaks so seeded decks (seed_n1.py) surface in batch order.
        .order_by(models.Review.next_review.asc(), models.Card.id.asc())
        .limit(allowance)
        .all()
    )


def _due_queue(
    db: Session, card_type: Optional[str] = None, jlpt_level: Optional[str] = None
) -> List[models.Card]:
    """Cards to study right now — due repeats first, then today's new words."""
    return (
        _due_repeats(db, card_type, jlpt_level)
        + _new_words(db, card_type, jlpt_level)
    )


@router.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    total_cards = db.query(func.count(models.Card.id)).scalar() or 0

    # Count what the study queue will actually serve, per deck — each deck gets
    # its own DAILY_NEW_LIMIT, so a raw `next_review <= now` count would report
    # a number the user cannot act on.
    #
    # `if t` matters: _due_queue treats a falsy card_type as "every deck", so a
    # row with a NULL card_type would fold the whole queue into the sum on top
    # of the per-deck counts. Such rows belong to neither tab and can't be
    # studied, so they're left out of the count too.
    card_types = [t for (t,) in db.query(models.Card.card_type).distinct() if t]
    due_today = sum(len(_due_queue(db, t)) for t in card_types)

    mastered = db.query(func.count(models.Review.id)).filter(
        models.Review.interval >= 21
    ).scalar() or 0

    # Bucket reviews into calendar days in the study timezone. Pulling the raw
    # timestamps and converting in Python — rather than SQL DATE() — is what
    # makes the zone knowable at all, and it drops an untyped func.date() whose
    # return type varied by driver (a date on MySQL, a string on SQLite).
    zone = _app_zone()
    reviewed_at = (
        db.query(models.Review.last_reviewed)
        .filter(models.Review.last_reviewed.isnot(None))
        .all()
    )
    parsed_dates = sorted(
        {_to_local_date(ts, zone) for (ts,) in reviewed_at if ts is not None},
        reverse=True,
    )

    streak = 0
    today = datetime.now(zone).date()
    check = today

    # Not having studied *yet today* doesn't break a streak — only a missed
    # day does — so start counting from yesterday in that case.
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
    zone = _app_zone()
    # Same local-midnight boundary the streak and the new-word quota use, so
    # "studied today" means one thing across the whole app.
    today = _local_day_start(zone)

    n1_cards = db.query(models.Card).filter(models.Card.jlpt_level == "N1")
    total = n1_cards.count()

    n1_reviews = (
        db.query(models.Review)
        .join(models.Card, models.Card.id == models.Review.card_id)
        .filter(models.Card.jlpt_level == "N1")
    )

    # Unlocked = introduced to the user: either the initial unlock date has
    # passed (next_review <= now and never touched) or the card has been
    # studied at least once (learned_at set). Keying on learned_at rather than
    # repetitions matters now that cards repeat — grading one "Again" zeroes
    # repetitions, which would flip an introduced card back to locked.
    unlocked = n1_reviews.filter(
        models.Review.learned_at.isnot(None) | (models.Review.next_review <= now)
    ).count()

    # What a "Study Now" tap from this page serves right now: due repeats plus
    # today's remaining new words. Reported as due_today so the stat tile can't
    # advertise a number the session won't deliver.
    queued = len(_due_queue(db, "japanese", "N1"))
    due_today = queued

    # Mastered mirrors /learned (Review.learned_at IS NOT NULL) so the two
    # pages stay consistent — marking an N1 card learned counts it as mastered.
    mastered = n1_reviews.filter(models.Review.learned_at.isnot(None)).count()

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
        # Whole days between two local calendar dates — mixing a local-midnight
        # boundary with a UTC-floored start would drift by a day.
        start_day = _to_local_date(earliest, zone)
        current_day = max(1, (datetime.now(zone).date() - start_day).days + 1)

    per_day = DAILY_NEW_LIMIT
    total_days = (total + per_day - 1) // per_day

    # Today's batch = N1 words already studied today, followed by the new ones
    # the study queue will serve next. Both halves come from the same helpers
    # /reviews/due uses, so "Study Now" opens exactly the words listed here —
    # an id-slice by calendar day would drift from the queue the moment a day
    # got skipped or another level consumed the daily allowance.
    studied_today = (
        db.query(models.Card)
        .join(models.Review, models.Review.card_id == models.Card.id)
        .filter(
            models.Card.jlpt_level == "N1",
            models.Card.card_type == "japanese",
            models.Review.learned_at >= today,
        )
        .order_by(models.Review.learned_at.asc())
        .all()
    )
    studied_ids = {c.id for c in studied_today}
    todays_new = studied_today + _new_words(db, "japanese", "N1")

    upcoming = []
    for offset in range(1, 8):
        day_index = current_day + offset
        remaining = total - (day_index - 1) * per_day if day_index <= total_days else 0
        upcoming.append({
            "day_offset": offset,
            "new_words": max(0, min(per_day, remaining)),
        })

    return {
        "total": total,
        "unlocked": unlocked,
        "locked": total - unlocked,
        "mastered": mastered,
        "due_today": due_today,
        "current_day": current_day,
        "total_days": total_days,
        "queued": queued,
        "todays_new_words": [
            {
                "id": c.id,
                "japanese": c.japanese,
                "furigana": c.furigana,
                "english": c.english,
                "studied": c.id in studied_ids,
            }
            for c in todays_new
        ],
        "upcoming": upcoming,
    }


@router.get("/due", response_model=List[schemas.CardResponse])
def get_due_cards(
    card_type: Optional[str] = Query(None),
    jlpt_level: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    return _due_queue(db, card_type, jlpt_level)


@router.get("/learned/summary")
def get_learned_summary(
    card_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = (
        db.query(models.Card.jlpt_level, func.count(models.Review.id))
        .join(models.Review, models.Review.card_id == models.Card.id)
        .filter(models.Review.learned_at.isnot(None))
    )
    if card_type:
        query = query.filter(models.Card.card_type == card_type)
    rows = query.group_by(models.Card.jlpt_level).all()

    by_level = {level: count for level, count in rows}

    if card_type == "english":
        # English cards repurpose jlpt_level to hold part_of_speech; for the
        # English tab we just return a flat total (the UI shows a flat list).
        total = sum(by_level.values())
        return {"total": total, "by_level": []}

    # Total cards available per level (regardless of learned state) so the UI
    # can show real per-level progress (learned / available) instead of each
    # level's share of the overall learned count.
    avail_query = db.query(models.Card.jlpt_level, func.count(models.Card.id))
    if card_type:
        avail_query = avail_query.filter(models.Card.card_type == card_type)
    available_by_level = {
        level: count for level, count in avail_query.group_by(models.Card.jlpt_level).all()
    }

    levels = ["N5", "N4", "N3", "N2", "N1", "Unknown"]
    breakdown = [
        {
            "jlpt_level": lvl,
            "count": by_level.get(lvl, 0),
            "available": available_by_level.get(lvl, 0),
        }
        for lvl in levels
    ]
    total = sum(item["count"] for item in breakdown)
    return {"total": total, "by_level": breakdown}


@router.get("/learned/words", response_model=List[schemas.CardResponse])
def get_learned_words(
    jlpt_level: Optional[str] = Query(None),
    card_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = (
        db.query(models.Card)
        .join(models.Review, models.Review.card_id == models.Card.id)
        .filter(models.Review.learned_at.isnot(None))
    )
    if jlpt_level:
        query = query.filter(models.Card.jlpt_level == jlpt_level)
    if card_type:
        query = query.filter(models.Card.card_type == card_type)
    # Newest-learned first. Ordering on learned_at rather than last_reviewed
    # keeps the list stable — repeat reviews no longer reshuffle it.
    return query.order_by(models.Review.learned_at.desc()).all()


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
    db_review.learned_at = None      # back to being a new word
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

    now = datetime.utcnow()
    db_review.ease_factor = new_ef
    db_review.interval = new_interval
    db_review.repetitions = new_reps
    db_review.next_review = next_review
    db_review.last_reviewed = now
    # First time through counts the card as learned and consumes one slot of
    # today's DAILY_NEW_LIMIT. Later reviews leave it untouched.
    if db_review.learned_at is None:
        db_review.learned_at = now
    db.commit()
    db.refresh(db_review)
    return db_review

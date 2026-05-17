"""
Seed JLPT N1 vocabulary into the flashcard database.

Words are ordered by the Wiktionary page's corpus frequency column (lower rank =
more common), with N/A words appended afterward sorted by wordfreq.

Cards are split into batches of WORDS_PER_DAY. Each batch's next_review is set to
today + batch_index so the SRS engine surfaces exactly WORDS_PER_DAY new cards daily.

Run:       python seed_n1.py
Re-running is safe — existing N1 cards are skipped (idempotent).
"""

import json
import re
import subprocess
from datetime import datetime, timedelta

from wordfreq import word_frequency
from sqlalchemy.orm import Session
from database import SessionLocal, engine, Base
import models

WORDS_PER_DAY = 10
WIKTIONARY_URL = "https://en.wiktionary.org/wiki/Appendix:JLPT/N1"


def has_kanji(s: str) -> bool:
    return bool(re.search(r'[一-鿿]', s))


def fetch_and_rank() -> list[dict]:
    print("Fetching JLPT N1 word list from Wiktionary…")
    result = subprocess.run(["curl", "-s", WIKTIONARY_URL], capture_output=True, text=True)
    content = result.stdout

    rows = re.findall(r'<tr[^>]*>.*?</tr>', content, re.DOTALL)
    words = []
    for row in rows:
        cells = re.findall(r'<td[^>]*>(.*?)</td>', row, re.DOTALL)
        if len(cells) >= 4:
            kanji    = re.sub(r'<[^>]+>', '', cells[0]).strip()
            reading  = re.sub(r'<[^>]+>', '', cells[1]).strip()
            meaning  = re.sub(r'<[^>]+>', '', cells[2]).strip()
            freq_raw = re.sub(r'<[^>]+>', '', cells[3]).strip()
            if kanji and reading:
                words.append({
                    "kanji": kanji,
                    "reading": reading,
                    "meaning": meaning,
                    "freq_raw": freq_raw,
                })

    with_freq = []
    without_freq = []
    for w in words:
        if w["freq_raw"].isdigit():
            w["page_freq"] = int(w["freq_raw"])
            with_freq.append(w)
        else:
            wf = (word_frequency(w["kanji"], "ja") if has_kanji(w["kanji"])
                  else word_frequency(w["reading"], "ja"))
            w["page_freq"] = None
            w["wf"] = wf
            without_freq.append(w)

    # Higher page_freq = more common → sort descending
    with_freq.sort(key=lambda x: x["page_freq"], reverse=True)
    # N/A words: higher wordfreq = more common → sort descending
    without_freq.sort(key=lambda x: x["wf"], reverse=True)

    ordered = with_freq + without_freq
    for i, w in enumerate(ordered, 1):
        w["rank"] = i

    print(f"  {len(ordered)} words ranked "
          f"({len(with_freq)} with page freq, {len(without_freq)} via wordfreq fallback)")
    return ordered


def seed(words: list[dict], db: Session):
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    existing = {
        c.japanese
        for c in db.query(models.Card.japanese)
        .filter(models.Card.jlpt_level == "N1")
        .all()
    }

    inserted = 0
    skipped = 0

    for w in words:
        kanji = w["kanji"]
        if kanji in existing:
            skipped += 1
            continue

        batch = inserted // WORDS_PER_DAY
        unlock_date = today + timedelta(days=batch)

        # Keep first definition only
        short_meaning = re.split(r'\s*\[2\]', w["meaning"])[0].strip().rstrip(";").strip()

        card = models.Card(
            card_type="japanese",
            japanese=kanji,
            furigana=w["reading"],
            english=short_meaning,
            jlpt_level="N1",
        )
        db.add(card)
        db.flush()

        review = models.Review(
            card_id=card.id,
            next_review=unlock_date,
        )
        db.add(review)

        existing.add(kanji)
        inserted += 1

        if inserted % 500 == 0:
            db.commit()
            print(f"  …{inserted} inserted")

    db.commit()
    return inserted, skipped


def main():
    words = fetch_and_rank()

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        inserted, skipped = seed(words, db)
    finally:
        db.close()

    days = inserted // WORDS_PER_DAY
    print(f"\nDone.")
    print(f"  Inserted : {inserted} new N1 cards")
    print(f"  Skipped  : {skipped} (already existed)")
    print(f"  Schedule : {days} days "
          f"({days // 30} months {days % 30} days) at {WORDS_PER_DAY} words/day")


if __name__ == "__main__":
    main()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from database import engine, Base
from routers import cards, reviews, ocr

Base.metadata.create_all(bind=engine)


def _ensure_columns():
    """Add columns introduced after the tables were first created."""
    inspector = inspect(engine)

    card_columns = {c["name"] for c in inspector.get_columns("cards")}
    if "note" not in card_columns:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE cards ADD COLUMN note TEXT"))
            conn.execute(text("UPDATE cards SET note = '' WHERE note IS NULL"))

    review_columns = {c["name"] for c in inspector.get_columns("reviews")}
    if "learned_at" not in review_columns:
        # `last_reviewed IS NOT NULL` used to double as the "learned" flag,
        # which kept studied cards out of the review queue forever. The two
        # meanings now live in separate columns — backfill from the old one so
        # words already marked learned stay on the Learned page.
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE reviews ADD COLUMN learned_at DATETIME NULL"))
            conn.execute(text("UPDATE reviews SET learned_at = last_reviewed"))


_ensure_columns()

app = FastAPI(title="Japanese FlashCard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "app://.",
        "file://",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(cards.router, prefix="/cards", tags=["cards"])
app.include_router(reviews.router, prefix="/reviews", tags=["reviews"])
app.include_router(ocr.router, prefix="/ocr", tags=["ocr"])


@app.get("/")
def root():
    return {"status": "ok"}

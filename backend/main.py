from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from database import engine, Base
from routers import cards, reviews, ocr

Base.metadata.create_all(bind=engine)


def _ensure_columns():
    """Add columns introduced after the table was first created."""
    existing = {c["name"] for c in inspect(engine).get_columns("cards")}
    if "note" not in existing:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE cards ADD COLUMN note TEXT"))
            conn.execute(text("UPDATE cards SET note = '' WHERE note IS NULL"))


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

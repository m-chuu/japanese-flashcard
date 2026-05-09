from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine, Base
from routers import cards, reviews, ocr

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Japanese FlashCard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
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

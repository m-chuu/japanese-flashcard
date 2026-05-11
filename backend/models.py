from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class Card(Base):
    __tablename__ = "cards"

    id = Column(Integer, primary_key=True, index=True)
    card_type = Column(String(20), default="japanese")
    japanese = Column(String(255), nullable=False)
    furigana = Column(String(255), default="")
    english = Column(Text, default="")
    example_sentence = Column(Text, default="")
    synonym = Column(String(500), default="")
    jlpt_level = Column(String(10), default="Unknown")
    created_at = Column(DateTime, default=datetime.utcnow)

    review = relationship("Review", back_populates="card", uselist=False, cascade="all, delete-orphan")


class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    card_id = Column(Integer, ForeignKey("cards.id"), nullable=False, unique=True)
    ease_factor = Column(Float, default=2.5)
    interval = Column(Integer, default=1)       # days until next review
    repetitions = Column(Integer, default=0)
    next_review = Column(DateTime, default=datetime.utcnow)
    last_reviewed = Column(DateTime, nullable=True)

    card = relationship("Card", back_populates="review")

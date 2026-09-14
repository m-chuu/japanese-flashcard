from datetime import datetime, timedelta


def sm2(quality: int, ease_factor: float, interval: int, repetitions: int):
    """
    SM-2 spaced repetition algorithm.
    quality 0-2 = fail, 3-5 = pass (3=hard, 4=good, 5=easy).
    Returns (new_ease_factor, new_interval, new_repetitions, next_review_datetime).
    """
    if quality < 3:
        repetitions = 0
        interval = 1
    else:
        if repetitions == 0:
            interval = 1
        elif repetitions == 1:
            interval = 6
        else:
            interval = round(interval * ease_factor)
        repetitions += 1

    ease_factor += 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
    ease_factor = max(1.3, ease_factor)

    next_review = datetime.utcnow() + timedelta(days=interval)
    return ease_factor, interval, repetitions, next_review


# The rating buttons the Study page offers, as SM-2 quality scores.
RATING_QUALITIES = (0, 3, 4, 5)


def preview_intervals(
    ease_factor: float, interval: int, repetitions: int
) -> dict[int, int]:
    """Days until the next review for each rating button, given a card's state.

    sm2() is pure, so each grade can simply be run against the current state.
    Deriving the Study page's hints from here rather than restating them in the
    UI keeps them honest — a hardcoded "~3d" cannot track a card that is
    actually 238 days out.

    Note that 3/4/5 all yield the same interval: in SM-2 the grade moves
    ease_factor, which only shows up in *later* intervals.
    """
    return {
        quality: sm2(quality, ease_factor, interval, repetitions)[1]
        for quality in RATING_QUALITIES
    }

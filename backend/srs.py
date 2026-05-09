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

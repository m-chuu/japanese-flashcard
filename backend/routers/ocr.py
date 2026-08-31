from fastapi import APIRouter, UploadFile, File, HTTPException
from PIL import Image, ImageEnhance, ImageFilter
import numpy as np
import io
import threading
import easyocr

router = APIRouter()

_reader = None

# Guards lazy construction. /extract runs on the threadpool (see below), so two
# concurrent first requests could otherwise each build a Reader — loading the
# detection and recognition models twice, and on a cold start downloading them
# twice as well.
_reader_lock = threading.Lock()

# EasyOCR's Reader wraps PyTorch models that aren't documented as safe for
# concurrent inference. Serialising readtext keeps OCR calls queued behind one
# another — as they already were on the event loop — while leaving the loop
# itself free to serve everything else.
_inference_lock = threading.Lock()


def get_reader() -> easyocr.Reader:
    global _reader
    if _reader is None:
        with _reader_lock:
            if _reader is None:      # another thread may have won the race
                _reader = easyocr.Reader(["ja", "en"], gpu=False)
    return _reader


def preprocess(image: Image.Image) -> np.ndarray:
    # Upscale small captures — kanji on screen are tiny, OCR needs size
    w, h = image.size
    min_side = min(w, h)
    if min_side < 100:
        scale = max(4, 400 // min_side)
    elif min_side < 300:
        scale = 3
    elif min_side < 600:
        scale = 2
    else:
        scale = 1

    if scale > 1:
        image = image.resize((w * scale, h * scale), Image.LANCZOS)

    # Sharpen edges so stroke details are clearer
    image = image.filter(ImageFilter.SHARPEN)

    # Boost contrast — helps separate dark kanji from light backgrounds
    image = ImageEnhance.Contrast(image).enhance(2.0)

    return np.array(image.convert("RGB"))


# Deliberately a sync `def`: FastAPI runs those in its threadpool, so the
# multi-second readtext() below never touches the event loop. Declared `async`
# it ran inline on the loop instead and froze every other request — the card
# list, stats, lookups — for the whole duration of each OCR call. The PIL
# preprocessing is CPU-heavy too, and this keeps that off the loop as well.
@router.post("/extract")
def extract_text(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    # Sync read — we're on a worker thread, so blocking here is fine.
    contents = file.file.read()
    image = Image.open(io.BytesIO(contents)).convert("RGB")
    image_np = preprocess(image)

    reader = get_reader()
    with _inference_lock:
        results = reader.readtext(
            image_np,
            paragraph=False,
            text_threshold=0.5,    # lower = catch more characters
            low_text=0.3,
            link_threshold=0.3,
            contrast_ths=0.1,
            adjust_contrast=0.7,
            batch_size=4,
        )

    # Join all detected segments; keep Japanese characters together
    text = "".join(r[1] for r in results).strip()
    return {"text": text}

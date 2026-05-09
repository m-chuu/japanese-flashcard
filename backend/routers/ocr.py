from fastapi import APIRouter, UploadFile, File, HTTPException
from PIL import Image, ImageEnhance, ImageFilter
import numpy as np
import io
import easyocr

router = APIRouter()

_reader = None


def get_reader() -> easyocr.Reader:
    global _reader
    if _reader is None:
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


@router.post("/extract")
async def extract_text(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    contents = await file.read()
    image = Image.open(io.BytesIO(contents)).convert("RGB")
    image_np = preprocess(image)

    reader = get_reader()
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

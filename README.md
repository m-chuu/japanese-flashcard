# Japanese FlashCard

A Japanese vocabulary flashcard desktop app with screen OCR capture. Press a global shortcut from anywhere on your Mac, select a region of Japanese text on screen, and the word is automatically extracted and pre-filled into a new flashcard — complete with furigana, English meaning, and JLPT level from Jisho.

---

## Features

- **Screen OCR capture** — `Option+Cmd+1` from anywhere on the desktop opens a region-select overlay; two clicks select the area; the cropped image is sent to EasyOCR and the extracted Japanese text pre-fills the Add Card form
- **Jisho auto-lookup** — after OCR, the app queries the Jisho.org API to auto-fill furigana, English meaning, and JLPT level
- **SM-2 spaced repetition** — the Study page schedules cards using the same algorithm as Anki (Again / Hard / Good / Easy buttons, 0–5 quality scale)
- **JLPT filtering** — cards are tagged N5 → N1 or Unknown; the home page filters by level
- **Edit / delete** — all cards are editable after creation

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron 28 |
| Frontend | React 18 + TypeScript + Vite 5 |
| Styling | Tailwind CSS 3 |
| Backend | FastAPI + Uvicorn |
| Database | MySQL 9 via SQLAlchemy 2 + PyMySQL |
| OCR | EasyOCR (Japanese + English, CPU) |
| Dictionary | Jisho.org REST API (free, no key) |
| SRS algorithm | SM-2 |

---

## Project Structure

```
Japanese FlashCard/
├── backend/
│   ├── .env                  # DATABASE_URL (git-ignored)
│   ├── requirements.txt
│   ├── setup_db.sql          # one-time DB creation
│   ├── main.py               # FastAPI app, CORS, router mounts
│   ├── database.py           # SQLAlchemy engine + session
│   ├── models.py             # Card, Review ORM models
│   ├── schemas.py            # Pydantic request/response schemas
│   ├── srs.py                # SM-2 algorithm
│   └── routers/
│       ├── cards.py          # CRUD + Jisho lookup
│       ├── reviews.py        # SRS due-cards + submit review
│       └── ocr.py            # Image upload → EasyOCR → text
│
└── frontend/
    ├── electron/
    │   ├── main.js           # Electron main process, global shortcut
    │   ├── preload.js        # IPC bridge for main window
    │   ├── cropPreload.js    # IPC bridge for crop overlay window
    │   └── crop.html         # Two-click region selector UI
    ├── src/
    │   ├── App.tsx           # Router, OCR event listener
    │   ├── api/client.ts     # Axios wrappers for all API calls
    │   ├── types/
    │   │   ├── index.ts      # Card, Review, JishoLookup, JLPT_LEVELS
    │   │   └── electron.d.ts # window.electronAPI type declaration
    │   ├── components/
    │   │   ├── Navbar.tsx
    │   │   └── FlashCard.tsx # 3D flip card + rating buttons
    │   └── pages/
    │       ├── Home.tsx      # Card grid with JLPT filter pills
    │       ├── Study.tsx     # SRS study session with progress bar
    │       └── AddCard.tsx   # Add / edit form with Jisho lookup
    ├── index.html
    ├── vite.config.ts
    ├── tailwind.config.js
    └── package.json
```

---

## Database Schema

**`cards`**

| Column | Type | Notes |
|---|---|---|
| id | INT PK | auto-increment |
| japanese | VARCHAR(255) | required |
| furigana | VARCHAR(255) | hiragana reading |
| english | TEXT | meaning / translation |
| example_sentence | TEXT | |
| synonym | VARCHAR(500) | |
| jlpt_level | VARCHAR(10) | N5 / N4 / N3 / N2 / N1 / Unknown |
| created_at | DATETIME | UTC |

**`reviews`** (one row per card, SM-2 state)

| Column | Type | Notes |
|---|---|---|
| id | INT PK | |
| card_id | INT FK | unique → cards.id |
| ease_factor | FLOAT | default 2.5 |
| interval | INT | days until next review |
| repetitions | INT | successful review streak |
| next_review | DATETIME | UTC |
| last_reviewed | DATETIME | nullable |

---

## Setup

### Prerequisites

- Python 3.12
- Node.js 18+
- MySQL 9 (`brew install mysql` on macOS)

### 1 — MySQL

```bash
brew services start mysql
mysql -u root < backend/setup_db.sql
```

Edit `backend/.env`:

```
DATABASE_URL=mysql+pymysql://root:YOUR_PASSWORD@localhost:3306/japanese_flashcard
```

If MySQL was installed without a root password (Homebrew default):

```
DATABASE_URL=mysql+pymysql://root:@localhost:3306/japanese_flashcard
```

### 2 — Backend

```bash
cd backend
python3 -m venv myenv
source myenv/bin/activate
pip install -r requirements.txt
```

Fix macOS SSL certificates (required for EasyOCR model download, one-time only):

```bash
/Applications/Python\ 3.12/Install\ Certificates.command
```

Start the API server:

```bash
uvicorn main:app --reload
```

API runs at **http://localhost:8000** — Swagger UI at **http://localhost:8000/docs**

> **First OCR request:** EasyOCR downloads its Japanese detection and recognition models (~500 MB). This takes 1–2 minutes and happens once. Subsequent requests are fast.

### 3 — Frontend (browser only)

```bash
cd frontend
npm install
npm run dev
```

App runs at **http://localhost:5173**

### 4 — Electron desktop app (enables global shortcut)

With the Vite dev server already running:

```bash
cd frontend
NODE_ENV=development npx electron .
```

Or start both together:

```bash
npm run electron:dev
```

> **macOS Screen Recording permission:** The first time you press `Option+Cmd+1`, macOS will prompt for Screen Recording access. Grant it in **System Settings → Privacy & Security → Screen Recording**, then try again.

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| GET | `/cards/` | List all cards (optional `?jlpt_level=N5`) |
| POST | `/cards/` | Create a card |
| GET | `/cards/{id}` | Get one card |
| PUT | `/cards/{id}` | Update a card |
| DELETE | `/cards/{id}` | Delete a card |
| GET | `/cards/lookup/{word}` | Jisho lookup — returns furigana, meaning, JLPT |
| GET | `/reviews/due` | Cards due for review today |
| POST | `/reviews/` | Submit a review (`card_id`, `quality` 0–5) |
| POST | `/ocr/extract` | Upload image → returns extracted text |

---

## Screenshot Capture Flow

```
Option+Cmd+1 (system-wide)
  → Electron hides main window (opacity 0, no animation)
  → desktopCapturer captures full screen
  → Crop overlay window opens (full-screen, dark overlay)
  → Click ① top-left corner of Japanese text
  → Click ② bottom-right corner  →  selection box locks in
  → Click "📷 Capture" button
  → Main window reappears
  → Cropped image → POST /ocr/extract → EasyOCR
  → Extracted text → navigate to /add with pre-filled form
  → Jisho lookup fires automatically → furigana + meaning + JLPT filled
  → Review and save
```

---

## SRS Study Flow

The Study page uses the **SM-2 algorithm**:

| Button | Quality | Effect |
|---|---|---|
| Again | 0 | Reset to interval = 1 day |
| Hard | 3 | Interval increases slowly |
| Good | 4 | Normal interval increase |
| Easy | 5 | Large interval increase, ease factor rises |

Cards with `next_review ≤ now` appear in the study queue. After a session the next review date is stored in the `reviews` table.

# Japanese & English FlashCards

A vocabulary flashcard desktop app with screen OCR capture for Japanese, and Free Dictionary + YouGlish pronunciation for English. Press a global shortcut from anywhere on your Mac, select a region of Japanese text on screen, and the word is automatically extracted and pre-filled into a new flashcard — complete with furigana, English meaning, and JLPT level from Jisho.

---

## Features

- **Screen OCR capture** — `Option+Cmd+1` from anywhere on the desktop opens a region-select overlay; two clicks select the area; the cropped image is sent to EasyOCR and the extracted Japanese text pre-fills the Add Card form
- **Jisho auto-lookup** — after OCR, the app queries the Jisho.org API to auto-fill furigana, English meaning, and JLPT level
- **English flashcards** — separate English deck backed by the Free Dictionary API (no key); type any English word and click Lookup to auto-fill definition, IPA phonetic, example sentence, and synonyms
- **YouGlish pronunciation** — English card backs embed the YouGlish JS widget so you can hear native pronunciation in context from real YouTube videos
- **SM-2 spaced repetition** — the Study page schedules cards using the same algorithm as Anki (Again / Hard / Good / Easy buttons, 0–5 quality scale)
- **Separate study decks** — choose Japanese or English at the start of each study session
- **JLPT filtering** — Japanese cards are tagged N5 → N1 or Unknown; the home page filters by level
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
| JP Dictionary | Jisho.org REST API (free, no key) |
| EN Dictionary | Free Dictionary API — api.dictionaryapi.dev (free, no key) |
| Pronunciation | YouGlish JS widget (free, no key) |
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
│       ├── cards.py          # CRUD + Jisho lookup + English lookup
│       ├── reviews.py        # SRS due-cards (filterable by deck) + submit review
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
    │   │   ├── index.ts      # Card, Review, JishoLookup, EnglishLookup, JLPT_LEVELS
    │   │   └── electron.d.ts # window.electronAPI type declaration
    │   ├── components/
    │   │   ├── Navbar.tsx
    │   │   ├── FlashCard.tsx     # 3D flip card — JP and EN layouts
    │   │   └── YouGlishWidget.tsx # YouGlish pronunciation embed
    │   └── pages/
    │       ├── Home.tsx          # JP / EN deck tabs, due-count banners, card grid
    │       ├── Study.tsx         # Deck picker → SRS study session
    │       ├── AddCard.tsx       # Add / edit Japanese card with Jisho lookup
    │       └── AddEnglishCard.tsx # Add English card with Free Dictionary lookup
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
| card_type | VARCHAR(20) | `'japanese'` or `'english'` (default `'japanese'`) |
| japanese | VARCHAR(255) | JP word — or English word for EN cards |
| furigana | VARCHAR(255) | hiragana reading — or IPA phonetic for EN cards |
| english | TEXT | meaning / translation — or definition for EN cards |
| example_sentence | TEXT | |
| synonym | VARCHAR(500) | |
| jlpt_level | VARCHAR(10) | N5–N1 / Unknown — or part of speech for EN cards |
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

---

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

**Existing database migration** — if you already have a `cards` table from before the English flashcard feature was added, run this once to add the new column:

```sql
ALTER TABLE cards ADD COLUMN card_type VARCHAR(20) DEFAULT 'japanese';
```

New databases created by `setup_db.sql` already include this column — no action needed.

---

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

The API runs at **http://localhost:8000** — Swagger UI at **http://localhost:8000/docs**

> **Port already in use?** If you see `[Errno 48] Address already in use`, kill whatever is occupying port 8000 and restart:
> ```bash
> lsof -ti:8000 | xargs kill -9
> uvicorn main:app --reload
> ```

> **First OCR request:** EasyOCR downloads its Japanese detection and recognition models (~500 MB). This takes 1–2 minutes and happens once. Subsequent requests are fast.

---

### 3 — Frontend (browser)

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

App runs at **http://localhost:5173**

> Both terminals must stay open — the backend at port 8000 and the frontend at port 5173.

---

### 4 — Electron desktop app (enables global shortcut `Option+Cmd+1`)

With the Vite dev server already running (step 3):

```bash
cd frontend
NODE_ENV=development npx electron .
```

Or start both Vite and Electron together from one command:

```bash
cd frontend
npm run electron:dev
```

> **macOS Screen Recording permission:** The first time you press `Option+Cmd+1`, macOS will prompt for Screen Recording access. Grant it in **System Settings → Privacy & Security → Screen Recording**, then try again.

---

### Running order summary

| Step | Command | Terminal |
|---|---|---|
| 1 | `brew services start mysql` | any |
| 2 | `source backend/myenv/bin/activate && uvicorn main:app --reload` | Terminal A (keep open) |
| 3 | `cd frontend && npm run dev` | Terminal B (keep open) |
| 4 _(optional)_ | `NODE_ENV=development npx electron .` | Terminal C, or use `npm run electron:dev` in Terminal B instead of step 3 |

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| GET | `/cards/` | List cards (optional `?jlpt_level=N5`, `?card_type=japanese`) |
| POST | `/cards/` | Create a card |
| GET | `/cards/{id}` | Get one card |
| PUT | `/cards/{id}` | Update a card |
| DELETE | `/cards/{id}` | Delete a card |
| GET | `/cards/lookup/{word}` | Jisho lookup — returns furigana, meaning, JLPT |
| GET | `/cards/english-lookup/{word}` | Free Dictionary lookup — returns definition, IPA, example, synonyms |
| GET | `/reviews/due` | Cards due for review (optional `?card_type=english`) |
| POST | `/reviews/` | Submit a review (`card_id`, `quality` 0–5) |
| POST | `/ocr/extract` | Upload image → returns extracted Japanese text |

---

## Screenshot Capture Flow (Japanese)

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

## English Card Flow

```
Navbar → "+ EN Card"
  → Type an English word → click Lookup
  → GET /cards/english-lookup/{word} → api.dictionaryapi.dev
  → Fields auto-filled: IPA phonetic, part of speech, definition, example, synonyms
  → Edit any field manually if needed → Save
  → During study: card front shows the word
  → Tap to flip → definition + example + YouGlish widget loads
  → YouGlish plays YouTube clips of native speakers using the word in context
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

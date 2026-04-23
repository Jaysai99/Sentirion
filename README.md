# Sentirion — Market Sentiment Intelligence Terminal

Institutional-grade sentiment analysis across Reddit, SEC filings, and live market data. Designed for sales & trading desks, portfolio managers, and quant teams who need fast, reliable signal on what the market is saying — and why.

Sentiment scores are produced by **FinBERT** (a financial-domain BERT model) and range from **−1 (bearish) to +1 (bullish)**.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Next.js Frontend  (port 3000)                              │
│  Bloomberg-style terminal dashboard                         │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTP (server-side API routes)
┌─────────────────────▼───────────────────────────────────────┐
│  FastAPI Backend  (port 3001)                               │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐ │
│  │  Reddit API  │  │  SEC EDGAR   │  │  yfinance (market) │ │
│  └──────┬───────┘  └──────┬───────┘  └─────────┬──────────┘ │
│         └─────────────────▼──────────────────────┘          │
│                    FinBERT scoring                           │
└─────────────────────────────────────────────────────────────┘
```

**Data sources**

| Source | What it provides |
|--------|-----------------|
| Reddit | Retail sentiment — 47 quality-weighted finance subreddits |
| SEC EDGAR | Institutional signal — 10-K, 10-Q, 8-K filings (MD&A, risk sections) |
| yfinance | Price, market cap, P/E, beta, 52-week range, quarterly revenue & income |

---

## Prerequisites

| Tool | Min version | Notes |
|------|-------------|-------|
| Python | 3.10+ | 3.11 recommended |
| Node.js | 18+ | 20 LTS recommended |
| npm | 9+ | bundled with Node |
| Docker + Compose | 24+ | production only |

---

## Local development

### 1. Clone

```bash
git clone <repo-url> sentirion
cd sentirion
```

### 2. Configure environment variables

```bash
# Backend
cp backend/.env.example backend/.env
# Open backend/.env and fill in SEC_COMPANY_NAME and SEC_CONTACT_EMAIL

# Frontend (defaults work for local dev — copy only if you need overrides)
cp frontend/.env.local.example frontend/.env.local
```

### 3. Install Python dependencies

```bash
cd backend
pip install -r requirements.txt
cd ..
```

> The first startup downloads the FinBERT model (~500 MB). Subsequent starts use the local cache.

### 4. Install Node dependencies

```bash
cd frontend
npm install
cd ..
```

### 5. Start both services

```bash
cd frontend
npm run dev
```

This single command starts the Python backend (port 3001), waits for it to pass its health check, then starts the Next.js dev server (port 3000).

Open **http://localhost:3000/sentiment**

---

## Production deployment (Docker)

### Start

```bash
# 1. Set backend secrets
cp backend/.env.example backend/.env
#    Edit backend/.env — at minimum set SEC_COMPANY_NAME, SEC_CONTACT_EMAIL,
#    and ALLOWED_ORIGINS to match your frontend domain.

# 2. Build images and start containers
docker compose up --build -d
```

| Service | URL |
|---------|-----|
| Frontend | http://your-host:3000 |
| Backend API | http://your-host:3001 |

SEC filing data is written to a named Docker volume (`sec_data`) and persists across restarts.

### Common commands

```bash
# Stop
docker compose down

# Tail logs
docker compose logs -f backend
docker compose logs -f frontend

# Rebuild after code changes
docker compose up --build -d
```

---

## Environment variables

### Backend — `backend/.env`

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `127.0.0.1` | Bind address. Use `0.0.0.0` for Docker / remote access |
| `PORT` | `3001` | Listening port |
| `ALLOWED_ORIGINS` | `http://localhost:3000,...` | Comma-separated CORS origins |
| `SEC_COMPANY_NAME` | — | Your company name (required by SEC EDGAR) |
| `SEC_CONTACT_EMAIL` | — | Contact email for SEC EDGAR requests |
| `LOG_LEVEL` | `INFO` | `DEBUG` / `INFO` / `WARNING` / `ERROR` |

### Frontend — `frontend/.env.local`

| Variable | Default | Description |
|----------|---------|-------------|
| `SENTIRION_BACKEND_URL` | `http://127.0.0.1:3001` | Backend URL (server-side only; never exposed to the browser) |

---

## API reference

Base URL: `http://localhost:3001`

### `GET /api/sentiment/{ticker}`

Full sentiment deep-dive for a stock ticker or market topic (e.g. `AAPL`, `semiconductors`).

| Param | Default | Values |
|-------|---------|--------|
| `include_documents` | `true` | Include per-document records |
| `reddit_time_range` | `week` | `day` / `week` / `month` / `year` |

```bash
curl "http://localhost:3001/api/sentiment/NVDA?reddit_time_range=week"
```

**Key response fields**

| Field | Description |
|-------|-------------|
| `score` | Aggregate FinBERT score (−1 to +1) |
| `score_display` | `null` when coverage is below institutional threshold |
| `signal_quality` | Confidence score + volume / agreement / recency breakdown |
| `momentum` | Δ1H / Δ6H / Δ24H, trend label, regime shift |
| `divergence_signal` | Retail vs SEC spread |
| `stock_data` | Price, P/E, beta, 52-week range, revenue & income series |
| `filings_intelligence` | SEC section summaries and tone change labels |
| `live_stream` | Recent Reddit mentions and volume metrics |
| `narrative_engine` | Human-readable summary + actionable interpretation |
| `catalysts` | Key drivers behind the current reading |
| `signal_analytics.alerts` | Anomaly flags (extremes, spikes, divergence) |

---

### `GET /api/market-overview`

Lightweight sentiment heatmap across the core watchlist.

| Param | Default | Values |
|-------|---------|--------|
| `reddit_time_range` | `day` | `day` / `week` / `month` / `year` |

**Watchlist:** AAPL · MSFT · NVDA · GOOGL · META · AMZN · TSLA · JPM · GS · XOM

**Key response fields**

| Field | Description |
|-------|-------------|
| `indices` | S&P 500, Nasdaq 100, Dow Jones, VIX, 10Y Yield, Gold |
| `top_traded_tickers` | Watchlist sorted by mention volume |
| `heatmap` | Watchlist sorted by absolute sentiment |
| `sector_overview` | Sector-level sentiment averages |
| `sentiment_distribution` | Score histogram |

---

### `GET /health`

Returns `{"status": "ok"}` when the backend is ready to serve requests.

---

## Project structure

```
sentirion/
├── backend/
│   ├── app.py                # FastAPI entry point + config
│   ├── market_sentiment.py   # Reddit + SEC ingestion, FinBERT scoring pipeline
│   ├── dashboard_data.py     # Analytics: momentum, divergence, alerts, narratives
│   ├── financial_data.py     # yfinance stock snapshots and index overview
│   ├── sec_ingestion.py      # SEC EDGAR downloader
│   ├── text_cleaner.py       # HTML / XML text preprocessing
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example          # Template — copy to .env before running
│
├── frontend/
│   ├── src/app/
│   │   ├── page.js           # Landing page
│   │   ├── sentiment/page.js # Main terminal dashboard
│   │   └── api/              # Next.js server-side proxy routes → backend
│   ├── scripts/dev.js        # Unified dev launcher (starts both services)
│   ├── next.config.mjs
│   ├── Dockerfile
│   └── .env.local.example    # Template — copy to .env.local before running
│
├── docker-compose.yml        # One-command production stack
├── .gitignore
└── README.md
```

---

## Team notes

- **SEC filings** are downloaded on first query per ticker and cached in `backend/sec_data/`. This directory is gitignored; in production it is persisted via the `sec_data` Docker volume.
- **FinBERT cold start** takes ~30 s on first request (model loads into memory). The Docker healthcheck accounts for this with a 60-second start period.
- **Signal suppression**: if fewer than 30 total documents or 12 Reddit mentions are found, `score_display` returns `null` to prevent false precision on thin coverage. The raw `score` field is always populated.
- **Reddit**: uses the public JSON API — no credentials required. Default post limits are conservative to avoid rate limits.
- **CORS**: set `ALLOWED_ORIGINS` in `backend/.env` to your production frontend URL before deploying.

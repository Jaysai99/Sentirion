import logging
import os

import uvicorn
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

try:
    from .dashboard_data import build_market_overview, build_sentiment_dashboard
except ImportError:
    from dashboard_data import build_market_overview, build_sentiment_dashboard

# ── Logging ───────────────────────────────────────────────────────────────────
log_level = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, log_level, logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("sentirion")

# ── Config ────────────────────────────────────────────────────────────────────
HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", "3001"))

_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Sentirion API",
    description="Institutional-grade market sentiment intelligence.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/sentiment/{ticker}")
def sentiment(
    ticker: str,
    include_documents: bool = Query(True, description="Include per-document sentiment records"),
    reddit_time_range: str = Query("week", description="Reddit time range: day | week | month | year"),
):
    logger.info("sentiment request ticker=%s time_range=%s", ticker, reddit_time_range)
    result = build_sentiment_dashboard(ticker, reddit_time_range=reddit_time_range)

    if result["documents_analyzed"] == 0:
        raise HTTPException(status_code=404, detail="No Reddit or SEC documents found.")

    if not include_documents:
        result.pop("documents", None)

    return result


@app.get("/api/market-overview")
def market_overview(
    reddit_time_range: str = Query("day", description="Reddit time range: day | week | month | year"),
):
    logger.info("market-overview request time_range=%s", reddit_time_range)
    return build_market_overview(reddit_time_range=reddit_time_range)


if __name__ == "__main__":
    logger.info(
        "Sentirion backend starting on %s:%d  allowed_origins=%s",
        HOST, PORT, ALLOWED_ORIGINS,
    )
    uvicorn.run(app, host=HOST, port=PORT, log_level=log_level.lower())

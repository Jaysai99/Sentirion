from __future__ import annotations

import math
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timezone
from typing import Any

import yfinance as yf

INDEX_SYMBOLS = {
    "^GSPC": "S&P 500",
    "^IXIC": "Nasdaq 100",
    "^DJI": "Dow Jones",
    "^VIX": "VIX",
    "^TNX": "10Y Yield",
    "GC=F": "Gold",
}


def looks_like_ticker(query: str) -> bool:
    return bool(re.fullmatch(r"[A-Z][A-Z.\-]{0,5}", (query or "").strip().upper()))


def fetch_stock_snapshot(
    ticker: str,
    include_history: bool = True,
    include_financials: bool = True,
) -> dict[str, Any] | None:
    if not looks_like_ticker(ticker):
        return None

    symbol = ticker.strip().upper()
    instrument = yf.Ticker(symbol)
    info = _safe_get_info(instrument)
    fast_info = _safe_get_fast_info(instrument)
    history = instrument.history(period="1y" if include_history else "5d", interval="1d")

    current_price = _coerce_number(
        info.get("currentPrice")
        or fast_info.get("lastPrice")
        or _last_series_value(history.get("Close"))
    )
    previous_close = _coerce_number(
        info.get("previousClose")
        or fast_info.get("previousClose")
        or fast_info.get("regularMarketPreviousClose")
    )
    price_change_pct = None
    if current_price is not None and previous_close not in (None, 0):
        price_change_pct = round(((current_price - previous_close) / previous_close) * 100, 2)

    price_history = []
    if include_history:
        price_history = [
            {
                "date": index.date().isoformat(),
                "close": round(float(row["Close"]), 2),
                "volume": int(row["Volume"]) if not math.isnan(float(row["Volume"])) else 0,
            }
            for index, row in history.tail(180).iterrows()
            if not math.isnan(float(row["Close"]))
        ]

    revenue_series = []
    income_series = []
    if include_financials:
        revenue_series = _extract_financial_series(instrument.quarterly_income_stmt, "Total Revenue", limit=6)
        income_series = _extract_financial_series(
            instrument.quarterly_income_stmt,
            "Net Income",
            limit=6,
        )

    if current_price is None and not price_history and not info:
        return None

    return {
        "ticker": symbol,
        "company_name": info.get("shortName") or info.get("longName") or symbol,
        "sector": info.get("sector"),
        "industry": info.get("industry"),
        "price": current_price,
        "price_change_pct": price_change_pct,
        "market_cap": _coerce_number(info.get("marketCap") or fast_info.get("marketCap")),
        "average_volume": _coerce_number(
            info.get("averageVolume") or fast_info.get("threeMonthAverageVolume")
        ),
        "current_volume": _coerce_number(fast_info.get("lastVolume")),
        "year_high": _coerce_number(info.get("fiftyTwoWeekHigh") or fast_info.get("yearHigh")),
        "year_low": _coerce_number(info.get("fiftyTwoWeekLow") or fast_info.get("yearLow")),
        "forward_pe": _coerce_number(info.get("forwardPE")),
        "trailing_pe": _coerce_number(info.get("trailingPE")),
        "dividend_yield": _coerce_number(info.get("dividendYield")),
        "beta": _coerce_number(info.get("beta")),
        "business_summary": info.get("longBusinessSummary"),
        "historical_performance": price_history,
        "performance_summary": _build_performance_summary(price_history),
        "revenue_series": revenue_series,
        "income_series": income_series,
    }


def fetch_analyst_data(ticker: str) -> dict[str, Any] | None:
    """Return analyst price targets, recent rating changes, and recommendation consensus."""
    if not looks_like_ticker(ticker):
        return None
    try:
        instrument = yf.Ticker(ticker.upper())
        info       = _safe_get_info(instrument)

        # Price target summary
        targets_raw = None
        try:
            apt = instrument.analyst_price_targets
            if apt is not None and not getattr(apt, "empty", True):
                targets_raw = {
                    "current":  _coerce_number(apt.get("current")),
                    "mean":     _coerce_number(apt.get("mean")),
                    "high":     _coerce_number(apt.get("high")),
                    "low":      _coerce_number(apt.get("low")),
                    "number_of_analysts": _coerce_number(apt.get("numberOfAnalysts")),
                }
        except Exception:
            pass

        # Recent upgrades / downgrades (last 10)
        upgrades: list[dict[str, Any]] = []
        try:
            ud = instrument.upgrades_downgrades
            if ud is not None and not getattr(ud, "empty", True):
                for idx, row in ud.head(10).iterrows():
                    upgrades.append({
                        "date":       idx.date().isoformat() if hasattr(idx, "date") else str(idx),
                        "firm":       row.get("Firm", ""),
                        "to_grade":   row.get("ToGrade", ""),
                        "from_grade": row.get("FromGrade", ""),
                        "action":     row.get("Action", ""),
                    })
        except Exception:
            pass

        # Recommendation from info (e.g. "buy", "hold", "sell")
        recommendation = info.get("recommendationKey") or info.get("recommendation")
        num_analysts   = _coerce_number(info.get("numberOfAnalystOpinions"))
        target_price   = _coerce_number(info.get("targetMeanPrice"))
        target_high    = _coerce_number(info.get("targetHighPrice"))
        target_low     = _coerce_number(info.get("targetLowPrice"))

        if targets_raw is None and target_price:
            targets_raw = {
                "mean": target_price,
                "high": target_high,
                "low":  target_low,
                "number_of_analysts": num_analysts,
            }

        return {
            "recommendation":      recommendation,
            "num_analysts":        num_analysts,
            "price_targets":       targets_raw,
            "recent_upgrades":     upgrades,
        }
    except Exception:
        return None


def fetch_earnings_calendar(ticker: str) -> dict[str, Any] | None:
    """Return next earnings date and EPS/revenue estimates if available."""
    if not looks_like_ticker(ticker):
        return None
    try:
        instrument = yf.Ticker(ticker.upper())
        info       = _safe_get_info(instrument)

        next_date = None
        try:
            earnings_dates = instrument.earnings_dates
            if earnings_dates is not None and not getattr(earnings_dates, "empty", True):
                now = date.today()
                future_rows = [
                    (idx, row)
                    for idx, row in earnings_dates.iterrows()
                    if hasattr(idx, "date") and idx.date() >= now
                ]
                if future_rows:
                    next_idx, next_row = future_rows[0]
                    next_date = {
                        "date":               next_idx.date().isoformat(),
                        "eps_estimate":       _coerce_number(next_row.get("EPS Estimate")),
                        "reported_eps":       _coerce_number(next_row.get("Reported EPS")),
                        "surprise_pct":       _coerce_number(next_row.get("Surprise(%)")),
                    }
        except Exception:
            pass

        return {
            "next_earnings":           next_date,
            "eps_trailing_12m":        _coerce_number(info.get("trailingEps")),
            "eps_forward":             _coerce_number(info.get("forwardEps")),
            "revenue_per_share":       _coerce_number(info.get("revenuePerShare")),
            "earnings_growth_yoy":     _coerce_number(info.get("earningsGrowth")),
            "revenue_growth_yoy":      _coerce_number(info.get("revenueGrowth")),
            "profit_margins":          _coerce_number(info.get("profitMargins")),
            "operating_margins":       _coerce_number(info.get("operatingMargins")),
            "return_on_equity":        _coerce_number(info.get("returnOnEquity")),
            "return_on_assets":        _coerce_number(info.get("returnOnAssets")),
            "debt_to_equity":          _coerce_number(info.get("debtToEquity")),
            "current_ratio":           _coerce_number(info.get("currentRatio")),
            "free_cashflow":           _coerce_number(info.get("freeCashflow")),
        }
    except Exception:
        return None


_FICC_CATEGORY_SYMBOLS: dict[str, list[tuple[str, str]]] = {
    "equities": [
        ("^FTSE",  "FTSE 100"),
        ("^GDAXI", "DAX"),
        ("^FCHI",  "CAC 40"),
        ("^N225",  "Nikkei 225"),
        ("^HSI",   "Hang Seng"),
        ("^AXJO",  "ASX 200"),
        ("^BSESN", "Sensex"),
        ("^BVSP",  "Bovespa"),
        ("^MXX",   "IPC Mexico"),
        ("^KS11",  "KOSPI"),
    ],
    "forex": [
        ("EURUSD=X", "EUR/USD"),
        ("GBPUSD=X", "GBP/USD"),
        ("JPY=X",    "USD/JPY"),
        ("CNY=X",    "USD/CNY"),
        ("AUDUSD=X", "AUD/USD"),
        ("CAD=X",    "USD/CAD"),
        ("CHF=X",    "USD/CHF"),
        ("INR=X",    "USD/INR"),
        ("MXN=X",    "USD/MXN"),
        ("BRL=X",    "USD/BRL"),
    ],
    "commodities": [
        ("GC=F",  "Gold"),
        ("SI=F",  "Silver"),
        ("PL=F",  "Platinum"),
        ("CL=F",  "WTI Crude"),
        ("BZ=F",  "Brent Crude"),
        ("NG=F",  "Natural Gas"),
        ("HG=F",  "Copper"),
        ("ZW=F",  "Wheat"),
        ("ZC=F",  "Corn"),
        ("ZS=F",  "Soybeans"),
    ],
    "crypto": [
        ("BTC-USD", "Bitcoin"),
        ("ETH-USD", "Ethereum"),
        ("SOL-USD", "Solana"),
        ("XRP-USD", "XRP"),
        ("BNB-USD", "BNB"),
    ],
    "rates": [
        ("^IRX", "13W T-Bill"),
        ("^FVX", "5Y Treasury"),
        ("^TNX", "10Y Treasury"),
        ("^TYX", "30Y Treasury"),
    ],
    "shipping": [
        ("BDRY", "Dry Bulk ETF"),
        ("SBLK", "Star Bulk Carriers"),
        ("ZIM",  "ZIM Integrated Shipping"),
        ("MATX", "Matson Inc"),
        ("NMM",  "Navios Maritime"),
    ],
}


def _fetch_single_ficc(symbol: str, name: str) -> dict[str, Any] | None:
    try:
        instrument = yf.Ticker(symbol)
        history = instrument.history(period="1mo", interval="1d")
        closes = history.get("Close")
        if closes is None or getattr(closes, "empty", True):
            return None
        last = _last_series_value(closes)
        prev = _previous_series_value(closes)
        change_pct = None
        if last is not None and prev not in (None, 0):
            change_pct = round(((last - prev) / prev) * 100, 4)
        return {
            "symbol": symbol,
            "name": name,
            "price": last,
            "change_pct": change_pct,
            "history": [
                {"date": idx.date().isoformat(), "close": round(float(v), 4)}
                for idx, v in closes.tail(30).items()
                if not math.isnan(float(v))
            ],
        }
    except Exception:
        return None


def fetch_ficc_overview() -> dict[str, Any]:
    """Fetch all FICC asset classes concurrently: global equities, forex, commodities, crypto, rates, shipping."""
    all_tasks: list[tuple[str, str, str]] = [
        (category, symbol, name)
        for category, pairs in _FICC_CATEGORY_SYMBOLS.items()
        for symbol, name in pairs
    ]

    results: dict[str, list] = {cat: [] for cat in _FICC_CATEGORY_SYMBOLS}

    with ThreadPoolExecutor(max_workers=16) as pool:
        futures = {
            pool.submit(_fetch_single_ficc, sym, name): (cat, sym)
            for cat, sym, name in all_tasks
        }
        for fut in as_completed(futures):
            cat, _sym = futures[fut]
            try:
                data = fut.result()
                if data:
                    results[cat].append(data)
            except Exception:
                pass

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        **results,
    }


def fetch_index_overview() -> list[dict[str, Any]]:
    snapshots: list[dict[str, Any]] = []

    for symbol, name in INDEX_SYMBOLS.items():
        instrument = yf.Ticker(symbol)
        history = instrument.history(period="1mo", interval="1d")
        closes = history.get("Close")
        last_close = _last_series_value(closes)
        previous_close = _previous_series_value(closes)
        change_pct = None
        if last_close is not None and previous_close not in (None, 0):
            change_pct = round(((last_close - previous_close) / previous_close) * 100, 2)

        snapshots.append(
            {
                "symbol": symbol,
                "name": name,
                "price": last_close,
                "change_pct": change_pct,
                "history": [
                    {
                        "date": index.date().isoformat(),
                        "close": round(float(value), 2),
                    }
                    for index, value in closes.tail(30).items()
                    if not math.isnan(float(value))
                ],
            }
        )

    return snapshots


def _safe_get_info(instrument: Any) -> dict[str, Any]:
    try:
        return instrument.info or {}
    except Exception:
        return {}


def _safe_get_fast_info(instrument: Any) -> dict[str, Any]:
    try:
        return dict(instrument.fast_info or {})
    except Exception:
        return {}


def _extract_financial_series(statement: Any, row_name: str, limit: int = 4) -> list[dict[str, Any]]:
    if statement is None or row_name not in statement.index:
        return []

    row = statement.loc[row_name]
    series: list[dict[str, Any]] = []

    for column, value in row.iloc[:limit].items():
        numeric_value = _coerce_number(value)
        if numeric_value is None:
            continue

        column_date = _coerce_date(column)
        series.append(
            {
                "period_end": column_date.isoformat() if column_date else str(column),
                "value": numeric_value,
            }
        )

    return list(reversed(series))


def _build_performance_summary(price_history: list[dict[str, Any]]) -> dict[str, float | None]:
    if not price_history:
        return {}

    closes = [point["close"] for point in price_history if point.get("close") is not None]
    if not closes:
        return {}

    summary = {}
    windows = {
        "1w": 5,
        "1m": 21,
        "3m": 63,
        "6m": 126,
    }
    current = closes[-1]

    for label, offset in windows.items():
        if len(closes) <= offset or closes[-offset - 1] == 0:
            summary[label] = None
            continue
        summary[label] = round(((current - closes[-offset - 1]) / closes[-offset - 1]) * 100, 2)

    return summary


def _last_series_value(series: Any) -> float | None:
    if series is None or getattr(series, "empty", True):
        return None
    value = series.iloc[-1]
    return None if math.isnan(float(value)) else round(float(value), 2)


def _previous_series_value(series: Any) -> float | None:
    if series is None or getattr(series, "empty", True) or len(series) < 2:
        return None
    value = series.iloc[-2]
    return None if math.isnan(float(value)) else round(float(value), 2)


def _coerce_number(value: Any) -> float | int | None:
    if value is None:
        return None

    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None

    if math.isnan(numeric):
        return None

    if numeric.is_integer():
        return int(numeric)
    return round(numeric, 2)


def _coerce_date(value: Any) -> date | None:
    if hasattr(value, "date"):
        try:
            return value.date()
        except Exception:
            return None
    return None

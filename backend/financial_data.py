from __future__ import annotations

import math
import re
from datetime import date
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

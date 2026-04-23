import argparse
import json
import re
from collections import Counter
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any, Iterable, Sequence

import requests
import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

try:
    from .sec_ingestion import fetch_sec_filings
    from .text_cleaner import clean_social_text, extract_sec_sections
except ImportError:
    from sec_ingestion import fetch_sec_filings
    from text_cleaner import clean_social_text, extract_sec_sections

MODEL_NAME = "ProsusAI/finbert"
BASE_DIR = Path(__file__).resolve().parent
DEFAULT_SEC_DATA_DIR = BASE_DIR / "sec_data"
REDDIT_SEARCH_URL = "https://www.reddit.com/search.json"
REDDIT_COMMENTS_URL = "https://www.reddit.com/comments/{post_id}.json"
REQUEST_TIMEOUT_SECONDS = 12
REDDIT_POST_LIMIT = 20
REDDIT_COMMENTS_PER_POST = 3
SEC_SECTIONS_PER_FILING = 8
SENTIMENT_THRESHOLD = 0.15
REDDIT_CANDIDATE_MULTIPLIER = 4
MIN_POST_RELEVANCE = 6
MIN_COMMENT_RELEVANCE = 5
MAX_POSTS_PER_SUBREDDIT = 2
REDDIT_SORT_MODES = ("relevance", "new", "top")
VALID_REDDIT_TIME_RANGES = {"day", "week", "month", "year"}
SUBREDDIT_QUALITY_WEIGHTS = {
    "aapl": 4,
    "investing": 3,
    "stocks": 3,
    "valueinvesting": 3,
    "securityanalysis": 3,
    "stockmarket": 2,
    "options": 2,
    "wallstreetbets": 1,
}
FINANCE_SUBREDDITS = {
    "aapl",
    "algotrading",
    "canadainvestor",
    "daytrading",
    "dividends",
    "economics",
    "finance",
    "fluentinfinance",
    "investing",
    "options",
    "pennystocks",
    "personalfinance",
    "portfolios",
    "robinhood",
    "securityanalysis",
    "stockmarket",
    "stocks",
    "thetagang",
    "valueinvesting",
    "wallstreetbets",
}
FINANCE_KEYWORDS = {
    "analyst",
    "bearish",
    "bullish",
    "dividend",
    "earnings",
    "eps",
    "filing",
    "forecast",
    "guidance",
    "market",
    "margin",
    "options",
    "portfolio",
    "price target",
    "quarter",
    "q1",
    "q2",
    "q3",
    "q4",
    "revenue",
    "sec",
    "shares",
    "stock",
    "ticker",
    "valuation",
}
PROMOTION_KEYWORDS = {
    "affiliate",
    "coupon code",
    "discount",
    "giveaway",
    "promo code",
    "referral",
    "telegram",
    "verified all-access",
}


@dataclass
class SourceDocument:
    ticker: str
    source: str
    document_type: str
    text: str
    snippet: str
    metadata: dict[str, Any]


@dataclass
class ScoredDocument:
    ticker: str
    source: str
    document_type: str
    snippet: str
    sentiment_score: float
    label: str
    confidence: float
    metadata: dict[str, Any]


@lru_cache(maxsize=1)
def load_finbert() -> tuple[Any, Any, str, dict[int, str]]:
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    model = AutoModelForSequenceClassification.from_pretrained(MODEL_NAME)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model.to(device)
    model.eval()
    id2label = {
        int(index): str(label).lower()
        for index, label in model.config.id2label.items()
    }
    return tokenizer, model, device, id2label


def trim_snippet(text: str, max_chars: int = 260) -> str:
    if not text:
        return ""
    return text[:max_chars].rstrip() + "..." if len(text) > max_chars else text


def mentions_ticker(text: str, ticker: str) -> bool:
    pattern = re.compile(rf"(?<![A-Za-z0-9])\$?{re.escape(ticker)}(?![A-Za-z0-9])", re.IGNORECASE)
    return bool(pattern.search(text))


def fetch_reddit_documents(
    ticker: str,
    post_limit: int = REDDIT_POST_LIMIT,
    comments_per_post: int = REDDIT_COMMENTS_PER_POST,
    time_range: str = "week",
    sort_modes: Sequence[str] | None = None,
    max_query_variants: int | None = None,
) -> list[SourceDocument]:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": "Sentirion/1.0 (market sentiment research; contact: sentirion@example.com)",
            "Accept": "application/json",
        }
    )

    documents: list[SourceDocument] = []
    seen_texts: set[str] = set()
    candidate_limit = min(max(post_limit * REDDIT_CANDIDATE_MULTIPLIER, 25), 100)
    candidate_posts: dict[str, tuple[int, dict[str, Any]]] = {}
    normalized_time_range = _normalize_reddit_time_range(time_range)
    active_sort_modes = tuple(sort_modes) if sort_modes else REDDIT_SORT_MODES
    query_variants = _build_reddit_query_variants(ticker)
    if max_query_variants is not None:
        query_variants = query_variants[:max_query_variants]

    for query_variant in query_variants:
        for sort_mode in active_sort_modes:
            try:
                response = session.get(
                    REDDIT_SEARCH_URL,
                    params={
                        "q": query_variant,
                        "sort": sort_mode,
                        "limit": candidate_limit,
                        "t": normalized_time_range,
                        "raw_json": 1,
                    },
                    timeout=REQUEST_TIMEOUT_SECONDS,
                )
                response.raise_for_status()
            except requests.RequestException as exc:
                print(f"Error fetching Reddit posts for {ticker}: {exc}")
                continue

            for child in response.json().get("data", {}).get("children", []):
                data = child.get("data", {})
                post_id = str(data.get("id", ""))
                if not post_id:
                    continue

                relevance_score = _score_reddit_post(data, ticker)
                if relevance_score < MIN_POST_RELEVANCE:
                    continue

                existing = candidate_posts.get(post_id)
                if existing is None or relevance_score > existing[0]:
                    data["sentirion_search_sort"] = sort_mode
                    candidate_posts[post_id] = (relevance_score, data)

    ranked_posts = _select_diverse_posts(candidate_posts.values(), post_limit)

    for relevance_score, data in ranked_posts:
        title = data.get("title") or ""
        body = data.get("selftext") or ""
        cleaned_text = clean_social_text(" ".join(part for part in [title, body] if part))

        if not cleaned_text:
            continue

        dedupe_key = cleaned_text.lower()
        if dedupe_key in seen_texts:
            continue
        seen_texts.add(dedupe_key)

        post_id = data.get("id", "")
        permalink = data.get("permalink", "")
        documents.append(
            SourceDocument(
                ticker=ticker,
                source="reddit",
                document_type="post",
                text=cleaned_text,
                snippet=trim_snippet(cleaned_text),
                metadata={
                    "source_id": post_id,
                    "subreddit": data.get("subreddit"),
                    "url": f"https://www.reddit.com{permalink}" if permalink else None,
                    "created_at": _format_reddit_timestamp(data.get("created_utc")),
                    "score": data.get("score"),
                    "comment_count": data.get("num_comments"),
                    "relevance_score": relevance_score,
                    "search_sort": data.get("sentirion_search_sort"),
                },
            )
        )

        comments = _fetch_reddit_comments(session, post_id, comments_per_post)
        for comment in comments:
            comment_text = clean_social_text(comment.get("body", ""))
            if not comment_text:
                continue

            comment_relevance = _score_reddit_comment(
                comment_text,
                ticker=ticker,
                subreddit=str(data.get("subreddit", "")),
                parent_relevance_score=relevance_score,
                comment_score=comment.get("score"),
            )
            if comment_relevance < MIN_COMMENT_RELEVANCE:
                continue

            comment_mentions_ticker = mentions_ticker(comment_text, ticker)
            comment_dedupe_key = comment_text.lower()
            if comment_dedupe_key in seen_texts:
                continue
            seen_texts.add(comment_dedupe_key)
            comment_permalink = comment.get("permalink") or permalink

            documents.append(
                SourceDocument(
                    ticker=ticker,
                    source="reddit",
                    document_type="comment",
                    text=comment_text,
                    snippet=trim_snippet(comment_text),
                    metadata={
                        "source_id": comment.get("id"),
                        "subreddit": data.get("subreddit"),
                        "url": f"https://www.reddit.com{comment_permalink}" if comment_permalink else None,
                        "created_at": _format_reddit_timestamp(comment.get("created_utc")),
                        "score": comment.get("score"),
                        "comment_count": 0,
                        "matched_via": "ticker" if comment_mentions_ticker else "parent_post_context",
                        "parent_post_id": post_id,
                        "relevance_score": comment_relevance,
                        "search_sort": data.get("sentirion_search_sort"),
                    },
                )
            )

    return documents


def build_sec_documents(
    ticker: str,
    sec_data_dir: str | Path = DEFAULT_SEC_DATA_DIR,
    refresh: bool = False,
    sections_per_filing: int = SEC_SECTIONS_PER_FILING,
) -> list[SourceDocument]:
    if not _looks_like_ticker(ticker):
        return []

    filing_paths = fetch_sec_filings(
        ticker,
        download_folder=str(sec_data_dir),
        limit=2,
        download_if_missing=True,
    )

    documents: list[SourceDocument] = []

    for filing_type, paths in filing_paths.items():
        for file_path in paths:
            raw_text = Path(file_path).read_text(encoding="utf-8", errors="ignore")
            filing_metadata = _extract_filing_metadata(raw_text, file_path)
            sections = extract_sec_sections(
                raw_text,
                chunk_size=180,
                max_chunks=sections_per_filing,
            )

            for index, section in enumerate(sections, start=1):
                documents.append(
                    SourceDocument(
                        ticker=ticker,
                        source="sec",
                        document_type=filing_type,
                        text=section["text"],
                        snippet=trim_snippet(section["text"]),
                        metadata={
                            "path": file_path,
                            "section_index": index,
                            "section_heading": section.get("section_heading"),
                            "section_theme": section.get("section_theme"),
                            **filing_metadata,
                        },
                    )
                )

    if refresh and not documents:
        print(f"SEC refresh requested for {ticker}, but no filings were available.")

    return documents


def score_documents(documents: Sequence[SourceDocument], batch_size: int = 8) -> list[ScoredDocument]:
    if not documents:
        return []

    tokenizer, model, device, id2label = load_finbert()
    scored_documents: list[ScoredDocument] = []
    positive_index = _find_label_index(id2label, "positive")
    negative_index = _find_label_index(id2label, "negative")

    for batch in _batched(documents, batch_size):
        texts = [document.text for document in batch]
        encoded = tokenizer(
            texts,
            return_tensors="pt",
            truncation=True,
            padding=True,
            max_length=256,
        )
        encoded = {key: value.to(device) for key, value in encoded.items()}

        with torch.no_grad():
            logits = model(**encoded).logits
            probabilities = torch.softmax(logits, dim=1).cpu().tolist()

        for document, probability_vector in zip(batch, probabilities):
            positive = probability_vector[positive_index]
            negative = probability_vector[negative_index]
            score = max(min(float(positive - negative), 1.0), -1.0)
            label_index = max(range(len(probability_vector)), key=lambda idx: probability_vector[idx])

            scored_documents.append(
                ScoredDocument(
                    ticker=document.ticker,
                    source=document.source,
                    document_type=document.document_type,
                    snippet=document.snippet,
                    sentiment_score=round(score, 4),
                    label=id2label.get(label_index, str(label_index)),
                    confidence=round(float(max(probability_vector)), 4),
                    metadata=document.metadata,
                )
            )

    return scored_documents


def aggregate_sentiment(
    ticker: str,
    documents: Sequence[ScoredDocument],
    reddit_timeframe: str = "last 7 days",
    query_kind: str = "ticker",
) -> dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat()
    source_counts = Counter(document.source for document in documents)
    document_type_counts = Counter(document.document_type for document in documents)
    avg_score = round(
        sum(document.sentiment_score for document in documents) / len(documents),
        4,
    ) if documents else 0.0
    label = _label_from_score(avg_score)

    timestamps = [
        document.metadata.get("created_at") or document.metadata.get("filed_at")
        for document in documents
        if document.metadata.get("created_at") or document.metadata.get("filed_at")
    ]
    timestamps.sort()

    payload = {
        "ticker": ticker,
        "query_kind": query_kind,
        "score": round(avg_score, 2),
        "label": label,
        "explanation": _build_explanation(label, len(documents), source_counts),
        "documents_analyzed": len(documents),
        "posts_used": source_counts.get("reddit", 0),
        "sources": dict(source_counts),
        "document_types": dict(document_type_counts),
        "time_window": {
            "generated_at": now,
            "reddit_scope": reddit_timeframe,
            "sec_scope": "latest cached or on-demand 10-K, 10-Q, and 8-K filings",
            "start": timestamps[0] if timestamps else None,
            "end": timestamps[-1] if timestamps else None,
        },
        "documents": [asdict(document) for document in documents],
    }
    return payload


def run_sentiment_pipeline(
    ticker: str,
    include_documents: bool = True,
    refresh_sec: bool = False,
    sec_data_dir: str | Path = DEFAULT_SEC_DATA_DIR,
    reddit_post_limit: int = REDDIT_POST_LIMIT,
    reddit_comments_per_post: int = REDDIT_COMMENTS_PER_POST,
    sec_sections_per_filing: int = SEC_SECTIONS_PER_FILING,
    reddit_time_range: str = "week",
) -> dict[str, Any]:
    normalized_ticker = ticker.upper().strip()
    query_kind = "ticker" if _looks_like_ticker(normalized_ticker) else "topic"
    reddit_documents = fetch_reddit_documents(
        normalized_ticker,
        post_limit=reddit_post_limit,
        comments_per_post=reddit_comments_per_post,
        time_range=reddit_time_range,
    )
    sec_documents = build_sec_documents(
        normalized_ticker,
        sec_data_dir=sec_data_dir,
        refresh=refresh_sec,
        sections_per_filing=sec_sections_per_filing,
    )

    scored_documents = score_documents(reddit_documents + sec_documents)
    payload = aggregate_sentiment(
        normalized_ticker,
        scored_documents,
        reddit_timeframe=_humanize_reddit_time_range(reddit_time_range),
        query_kind=query_kind,
    )

    if not include_documents:
        payload.pop("documents", None)

    return payload


def main() -> None:
    parser = argparse.ArgumentParser(description="Sentirion market sentiment CLI")
    parser.add_argument("ticker", type=str, help="Stock ticker symbol (for example, AAPL)")
    parser.add_argument("--json", action="store_true", help="Print the full JSON payload")
    parser.add_argument(
        "--refresh-sec",
        action="store_true",
        help="Download missing SEC filings before analysis",
    )
    parser.add_argument(
        "--hide-documents",
        action="store_true",
        help="Suppress document-level records in the output payload",
    )
    parser.add_argument(
        "--reddit-time-range",
        choices=sorted(VALID_REDDIT_TIME_RANGES),
        default="week",
        help="Time range used for Reddit collection",
    )
    args = parser.parse_args()

    result = run_sentiment_pipeline(
        args.ticker,
        include_documents=not args.hide_documents,
        refresh_sec=args.refresh_sec,
        reddit_time_range=args.reddit_time_range,
    )

    if result["documents_analyzed"] == 0:
        print(f"No Reddit or SEC documents found for {args.ticker.upper()}.")
        return

    if args.json:
        print(json.dumps(result, indent=2))
        return

    print(f"--- Sentirion Sentiment for {result['ticker']} ---")
    print(f"Aggregate Score: {result['score']:.2f}")
    print(f"Label: {result['label'].upper()}")
    print(f"Documents Analyzed: {result['documents_analyzed']}")
    print(f"Source Breakdown: {result['sources']}")
    print(f"Summary: {result['explanation']}")

    for document in result.get("documents", [])[:5]:
        print(
            f"- [{document['source']}:{document['document_type']}] "
            f"{document['sentiment_score']:+.2f} {document['snippet']}"
        )


def _fetch_reddit_comments(
    session: requests.Session,
    post_id: str,
    limit: int,
) -> list[dict[str, Any]]:
    if not post_id or limit <= 0:
        return []

    try:
        response = session.get(
            REDDIT_COMMENTS_URL.format(post_id=post_id),
            params={"limit": limit, "sort": "new", "raw_json": 1, "depth": 2},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
    except requests.RequestException:
        return []

    payload = response.json()
    if not isinstance(payload, list) or len(payload) < 2:
        return []

    comments_listing = payload[1].get("data", {}).get("children", [])
    comments: list[dict[str, Any]] = []
    _collect_comment_nodes(comments_listing, comments)
    return comments[:limit]


def _collect_comment_nodes(nodes: Sequence[dict[str, Any]], output: list[dict[str, Any]]) -> None:
    for node in nodes:
        if node.get("kind") != "t1":
            continue

        data = node.get("data", {})
        if data.get("body"):
            output.append(data)

        replies = data.get("replies")
        if isinstance(replies, dict):
            children = replies.get("data", {}).get("children", [])
            _collect_comment_nodes(children, output)


def _extract_filing_metadata(raw_text: str, file_path: str) -> dict[str, Any]:
    acceptance_match = re.search(r"<ACCEPTANCE-DATETIME>(\d{14})", raw_text)
    period_match = re.search(r"CONFORMED PERIOD OF REPORT:\s+(\d{8})", raw_text)

    filed_at = None
    reporting_period = None

    if acceptance_match:
        filed_at = datetime.strptime(acceptance_match.group(1), "%Y%m%d%H%M%S").replace(
            tzinfo=timezone.utc
        ).isoformat()

    if period_match:
        reporting_period = datetime.strptime(period_match.group(1), "%Y%m%d").date().isoformat()

    return {
        "path": file_path,
        "filed_at": filed_at,
        "reporting_period": reporting_period,
    }


def _format_reddit_timestamp(timestamp: Any) -> str | None:
    if not timestamp:
        return None

    try:
        return datetime.fromtimestamp(float(timestamp), tz=timezone.utc).isoformat()
    except (TypeError, ValueError, OSError):
        return None


def _build_explanation(label: str, count: int, source_counts: Counter[str]) -> str:
    source_parts = []
    if source_counts.get("reddit"):
        source_parts.append(f"{source_counts['reddit']} Reddit documents")
    if source_counts.get("sec"):
        source_parts.append(f"{source_counts['sec']} SEC passages")

    sources = " and ".join(source_parts) if source_parts else "0 documents"
    tone = {
        "positive": "bullish",
        "negative": "bearish",
        "neutral": "mixed to neutral",
    }[label]
    return f"Aggregate narrative is {tone} across {count} documents, using {sources}."


def _build_reddit_query_variants(query: str) -> list[str]:
    normalized_query = query.strip()
    if not normalized_query:
        return []

    variants = [normalized_query]
    if " " in normalized_query:
        variants.insert(0, f'"{normalized_query}"')
    elif normalized_query.isalpha() and len(normalized_query) <= 6:
        variants.extend([f'"{normalized_query}"', f"${normalized_query}"])

    deduped_variants = []
    seen = set()
    for variant in variants:
        lowered = variant.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        deduped_variants.append(variant)
    return deduped_variants


def _normalize_reddit_time_range(time_range: str) -> str:
    normalized = (time_range or "week").strip().lower()
    return normalized if normalized in VALID_REDDIT_TIME_RANGES else "week"


def _humanize_reddit_time_range(time_range: str) -> str:
    labels = {
        "day": "last 24 hours",
        "week": "last 7 days",
        "month": "last 30 days",
        "year": "last 12 months",
    }
    return labels[_normalize_reddit_time_range(time_range)]


def _select_diverse_posts(
    ranked_candidates: Sequence[tuple[int, dict[str, Any]]],
    post_limit: int,
) -> list[tuple[int, dict[str, Any]]]:
    ordered_candidates = sorted(
        ranked_candidates,
        key=lambda item: (-item[0], -float(item[1].get("created_utc") or 0)),
    )

    selected: list[tuple[int, dict[str, Any]]] = []
    selected_ids: set[str] = set()
    subreddit_counts: Counter[str] = Counter()

    for relevance_score, data in ordered_candidates:
        post_id = str(data.get("id", ""))
        subreddit = str(data.get("subreddit", "")).lower()

        if not post_id or post_id in selected_ids:
            continue
        if subreddit_counts[subreddit] >= MAX_POSTS_PER_SUBREDDIT:
            continue

        selected.append((relevance_score, data))
        selected_ids.add(post_id)
        subreddit_counts[subreddit] += 1

        if len(selected) >= post_limit:
            return selected

    for relevance_score, data in ordered_candidates:
        post_id = str(data.get("id", ""))
        if not post_id or post_id in selected_ids:
            continue

        selected.append((relevance_score, data))
        selected_ids.add(post_id)
        if len(selected) >= post_limit:
            break

    return selected


def _score_reddit_post(data: dict[str, Any], ticker: str) -> int:
    title = clean_social_text(data.get("title") or "")
    body = clean_social_text(data.get("selftext") or "")
    combined = " ".join(part for part in [title, body] if part)
    subreddit = str(data.get("subreddit", "")).lower()

    if not combined:
        return 0

    title_mentions = mentions_ticker(title, ticker)
    body_mentions = mentions_ticker(body, ticker)
    if not title_mentions and not body_mentions:
        return 0
    if body and not title_mentions and not mentions_ticker(body[:220], ticker) and subreddit != ticker.lower():
        return 0

    score = 0
    finance_hits = _count_finance_hits(combined)
    post_score = _safe_int(data.get("score"))
    comment_count = _safe_int(data.get("num_comments"))

    if title_mentions:
        score += 5
    if body_mentions:
        score += 3
    if _contains_cashtag(combined, ticker):
        score += 2
    if subreddit in FINANCE_SUBREDDITS or subreddit == ticker.lower():
        score += 2
    score += SUBREDDIT_QUALITY_WEIGHTS.get(subreddit, 0)
    if finance_hits:
        score += min(finance_hits, 4)
    score += _engagement_points(post_score, comment_count)
    if finance_hits == 0 and subreddit not in FINANCE_SUBREDDITS and subreddit != ticker.lower():
        score -= 4
    if post_score <= 0 and comment_count <= 1:
        score -= 3
    if _is_promotional_content(title, body, subreddit):
        score -= 10

    return score


def _score_reddit_comment(
    comment_text: str,
    ticker: str,
    subreddit: str,
    parent_relevance_score: int,
    comment_score: Any = None,
) -> int:
    normalized_subreddit = subreddit.lower()
    finance_hits = _count_finance_hits(comment_text)
    direct_match = mentions_ticker(comment_text, ticker)
    numeric_comment_score = _safe_int(comment_score)

    score = 0
    if direct_match:
        score += 5
    if _contains_cashtag(comment_text, ticker):
        score += 2
    if finance_hits:
        score += min(finance_hits, 3)
    if normalized_subreddit in FINANCE_SUBREDDITS or normalized_subreddit == ticker.lower():
        score += 1
    score += min(max(numeric_comment_score // 10, 0), 2)
    if parent_relevance_score >= 8:
        score += 1
    if not direct_match and finance_hits < 2:
        score -= 4
    if _is_promotional_content(comment_text, "", normalized_subreddit):
        score -= 10

    return score


def _count_finance_hits(text: str) -> int:
    lowered_text = text.lower()
    return sum(1 for keyword in FINANCE_KEYWORDS if keyword in lowered_text)


def _contains_cashtag(text: str, ticker: str) -> bool:
    return bool(re.search(rf"(?<![A-Za-z0-9])\\${re.escape(ticker)}(?![A-Za-z0-9])", text, re.IGNORECASE))


def _engagement_points(post_score: int, comment_count: int) -> int:
    points = 0
    if post_score >= 25:
        points += 1
    if post_score >= 100:
        points += 2
    if comment_count >= 10:
        points += 1
    if comment_count >= 50:
        points += 2
    return points


def _safe_int(value: Any) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def _is_promotional_content(title: str, body: str, subreddit: str) -> bool:
    lowered_text = f"{title} {body} {subreddit}".lower()
    return any(keyword in lowered_text for keyword in PROMOTION_KEYWORDS)


def _looks_like_ticker(query: str) -> bool:
    return bool(re.fullmatch(r"[A-Z][A-Z.\-]{0,5}", query.strip().upper()))


def _label_from_score(score: float) -> str:
    if score >= SENTIMENT_THRESHOLD:
        return "positive"
    if score <= -SENTIMENT_THRESHOLD:
        return "negative"
    return "neutral"


def _find_label_index(id2label: dict[int, str], label_name: str) -> int:
    normalized_label = label_name.lower()
    for index, label in id2label.items():
        if label == normalized_label:
            return index
    raise ValueError(f"FinBERT label '{label_name}' not found in model config: {id2label}")


def _batched(items: Sequence[SourceDocument], batch_size: int) -> Iterable[Sequence[SourceDocument]]:
    for index in range(0, len(items), batch_size):
        yield items[index : index + batch_size]


if __name__ == "__main__":
    main()

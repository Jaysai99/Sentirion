import html
import re
from typing import List

from bs4 import BeautifulSoup

URL_RE = re.compile(r"https?://\S+|www\.\S+", re.IGNORECASE)
MARKDOWN_LINK_RE = re.compile(r"\[([^\]]+)\]\([^)]+\)")
WHITESPACE_RE = re.compile(r"\s+")
NON_ASCII_RE = re.compile(r"[^\x00-\x7F]+")
SEC_ITEM_HEADING_RE = re.compile(r"^item\s+\d+[a-z]?(?:\.)?(?:\s|$)", re.IGNORECASE)

SEC_SECTION_RULES = (
    ("Risk Factors", re.compile(r"^(item\s+1a\.?\s+risk factors|risk factors)$", re.IGNORECASE)),
    (
        "MD&A",
        re.compile(
            r"^(item\s+7\.?\s+management(?:['’]s)? discussion and analysis.*|management(?:['’]s)? discussion and analysis.*|liquidity and capital resources|results of operations)$",
            re.IGNORECASE,
        ),
    ),
    (
        "Forward Guidance",
        re.compile(r"^(forward-looking statements|guidance|outlook)$", re.IGNORECASE),
    ),
    (
        "Market Risk",
        re.compile(
            r"^(item\s+7a\.?\s+quantitative and qualitative disclosures about market risk|market risk)$",
            re.IGNORECASE,
        ),
    ),
    ("Cybersecurity", re.compile(r"^(item\s+1c\.?\s+cybersecurity|cybersecurity)$", re.IGNORECASE)),
    ("Business", re.compile(r"^(item\s+1\.?\s+business|business)$", re.IGNORECASE)),
)
SEC_GARBAGE_PATTERNS = (
    "us-gaap:",
    "xbrli:",
    "ix:",
    "contextref",
    "xml:lang",
    "xlink:",
    "http://fasb.org",
    "javascript:void",
    "background-color:",
    "font-size:",
    "border-bottom:",
    "padding:",
    "defref_",
    "roleuri",
    "localname",
    "label t",
)
SEC_THEME_PRIORITY = {
    "MD&A": 0,
    "Risk Factors": 1,
    "Market Risk": 2,
    "Forward Guidance": 3,
    "Cybersecurity": 4,
    "Business": 5,
    "Disclosure": 6,
}


def _normalize_text(text: str) -> str:
    text = html.unescape(text or "")
    text = MARKDOWN_LINK_RE.sub(r"\1", text)
    text = URL_RE.sub(" ", text)
    text = NON_ASCII_RE.sub(" ", text)
    text = text.replace("\xa0", " ")
    return WHITESPACE_RE.sub(" ", text).strip()


def clean_social_text(raw_text: str) -> str:
    """
    Normalizes Reddit-style text while keeping sentence structure intact for FinBERT.
    """
    return _normalize_text(raw_text)


def clean_sec_text(raw_text: str) -> str:
    """
    Converts SEC filing HTML/XML into deduplicated paragraph text.
    """
    paragraphs = _extract_meaningful_sec_lines(raw_text)
    return "\n".join(paragraphs)


def _extract_html_payload(raw_text: str) -> str:
    lowered = raw_text.lower()
    start = lowered.find("<html")
    end = lowered.rfind("</html>")
    if start != -1 and end != -1 and end > start:
        return raw_text[start : end + len("</html>")]
    return raw_text


def _extract_meaningful_sec_lines(raw_text: str) -> list[str]:
    soup = BeautifulSoup(_extract_html_payload(raw_text), "lxml")

    for element in soup(["script", "style", "table"]):
        element.decompose()

    for element in soup.find_all(style=lambda value: value and "display:none" in value.replace(" ", "").lower()):
        element.decompose()

    for selector in ("ix|header", "ix|hidden", "ix|references", "ix|resources"):
        for element in soup.select(selector):
            element.decompose()

    paragraphs: List[str] = []
    seen = set()

    for raw_line in soup.get_text(separator="\n").splitlines():
        line = _normalize_text(raw_line)
        if not _is_meaningful_sec_line(line):
            continue

        dedupe_key = line.lower()
        if dedupe_key in seen:
            continue

        seen.add(dedupe_key)
        paragraphs.append(line)

    return paragraphs


def chunk_text(text: str, chunk_size: int = 180, max_chunks: int | None = 12) -> list[str]:
    """
    Splits cleaned filing text into compact FinBERT-friendly passages.
    """
    paragraphs = [p.strip() for p in text.splitlines() if p.strip()]
    chunks: list[str] = []
    current: list[str] = []
    current_words = 0

    for paragraph in paragraphs:
        words = paragraph.split()
        if not words:
            continue

        if len(words) >= chunk_size:
            if current:
                chunks.append(" ".join(current))
                current = []
                current_words = 0
            for i in range(0, len(words), chunk_size):
                chunk = " ".join(words[i : i + chunk_size])
                if chunk:
                    chunks.append(chunk)
            continue

        if current_words + len(words) > chunk_size and current:
            chunks.append(" ".join(current))
            current = []
            current_words = 0

        current.append(paragraph)
        current_words += len(words)

    if current:
        chunks.append(" ".join(current))

    if max_chunks is not None and len(chunks) > max_chunks:
        chunks = _sample_evenly(chunks, max_chunks)

    return chunks


def extract_sec_sections(
    raw_text: str,
    chunk_size: int = 180,
    max_chunks: int = 12,
) -> list[dict[str, str]]:
    lines = _extract_meaningful_sec_lines(raw_text)
    sections: list[dict[str, str]] = []
    current_theme: str | None = None
    current_heading: str | None = None
    current_paragraphs: list[str] = []

    for line in lines:
        heading_match = _match_sec_heading(line)
        if heading_match:
            if current_theme and current_paragraphs:
                sections.extend(
                    _build_section_chunks(
                        current_theme,
                        current_heading or current_theme,
                        current_paragraphs,
                        chunk_size,
                    )
                )
            current_theme = heading_match["section_theme"]
            current_heading = heading_match["section_heading"]
            current_paragraphs = []
            continue

        if SEC_ITEM_HEADING_RE.match(line):
            if current_theme and current_paragraphs:
                sections.extend(
                    _build_section_chunks(
                        current_theme,
                        current_heading or current_theme,
                        current_paragraphs,
                        chunk_size,
                    )
                )
            current_theme = None
            current_heading = None
            current_paragraphs = []
            continue

        if not current_theme:
            continue

        current_paragraphs.append(line)

    if current_theme and current_paragraphs:
        sections.extend(_build_section_chunks(current_theme, current_heading or current_theme, current_paragraphs, chunk_size))

    if not sections:
        cleaned = clean_sec_text(raw_text)
        fallback_chunks = chunk_text(cleaned, chunk_size=chunk_size, max_chunks=max_chunks)
        return [
            {
                "text": chunk,
                "section_heading": "Disclosure",
                "section_theme": "Disclosure",
            }
            for chunk in fallback_chunks
        ]

    return _prioritize_sec_sections(sections, max_chunks)


def _is_meaningful_sec_line(line: str) -> bool:
    lowered = line.lower()
    if any(pattern in lowered for pattern in SEC_GARBAGE_PATTERNS):
        return False
    if re.fullmatch(r"[\W\d_]+", line):
        return False
    if _match_sec_heading(line):
        return True
    if len(line) < 60 or len(line) > 1800:
        return False
    alpha_count = sum(char.isalpha() for char in line)
    digit_count = sum(char.isdigit() for char in line)
    if alpha_count < 25:
        return False
    if digit_count / max(len(line), 1) > 0.18:
        return False
    if alpha_count / max(len(line), 1) < 0.55:
        return False
    return True


def _match_sec_heading(line: str) -> dict[str, str] | None:
    normalized = re.sub(r"\s+", " ", line).strip(" .:-")
    is_heading_candidate = SEC_ITEM_HEADING_RE.match(normalized) or len(normalized) <= 220
    if not is_heading_candidate:
        return None
    for theme, pattern in SEC_SECTION_RULES:
        if pattern.search(normalized):
            return {
                "section_heading": normalized,
                "section_theme": theme,
            }
    return None


def _build_section_chunks(
    section_theme: str,
    section_heading: str,
    paragraphs: list[str],
    chunk_size: int,
) -> list[dict[str, str]]:
    chunks: list[dict[str, str]] = []
    current: list[str] = []
    current_words = 0

    for paragraph in paragraphs:
        words = paragraph.split()
        if not words:
            continue

        if current_words + len(words) > chunk_size and current:
            chunks.append(
                {
                    "text": f"{section_heading}: {' '.join(current)}",
                    "section_heading": section_heading,
                    "section_theme": section_theme,
                }
            )
            current = []
            current_words = 0

        current.append(paragraph)
        current_words += len(words)

    if current:
        chunks.append(
            {
                "text": f"{section_heading}: {' '.join(current)}",
                "section_heading": section_heading,
                "section_theme": section_theme,
            }
        )

    return chunks


def _prioritize_sec_sections(sections: list[dict[str, str]], max_chunks: int) -> list[dict[str, str]]:
    ranked = sorted(
        sections,
        key=lambda section: (
            SEC_THEME_PRIORITY.get(section.get("section_theme", "Disclosure"), 99),
            -len(section.get("text", "")),
        ),
    )

    selected: list[dict[str, str]] = []
    theme_counts: dict[str, int] = {}

    for section in ranked:
        theme = section.get("section_theme", "Disclosure")
        if theme_counts.get(theme, 0) >= 2:
            continue
        selected.append(section)
        theme_counts[theme] = theme_counts.get(theme, 0) + 1
        if len(selected) >= max_chunks:
            break

    if len(selected) < max_chunks:
        selected_ids = {id(section) for section in selected}
        for section in ranked:
            if id(section) in selected_ids:
                continue
            selected.append(section)
            if len(selected) >= max_chunks:
                break

    return selected


def _sample_evenly(items: list[str], limit: int) -> list[str]:
    if limit <= 0 or len(items) <= limit:
        return items

    if limit == 1:
        return [items[0]]

    step = (len(items) - 1) / (limit - 1)
    indexes = []

    for i in range(limit):
        idx = round(i * step)
        if idx not in indexes:
            indexes.append(idx)

    while len(indexes) < limit:
        candidate = len(indexes)
        if candidate not in indexes:
            indexes.append(candidate)

    indexes.sort()
    return [items[idx] for idx in indexes[:limit]]


if __name__ == "__main__":
    import os
    import sys

    if len(sys.argv) < 2:
        print("Usage: python3 text_cleaner.py <FILE_PATH>")
        sys.exit(1)

    file_path = sys.argv[1]

    if not os.path.exists(file_path):
        print(f"Error: File '{file_path}' not found.")
        sys.exit(1)

    with open(file_path, "r", encoding="utf-8", errors="ignore") as file_handle:
        raw_content = file_handle.read()

    cleaned = clean_sec_text(raw_content)
    chunks = chunk_text(cleaned)

    print(f"Cleaned paragraphs: {len(cleaned.splitlines())}")
    print(f"Generated chunks: {len(chunks)}")
    if chunks:
        print("\n--- First Chunk ---")
        print(chunks[0][:800])

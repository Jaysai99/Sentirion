import os
from pathlib import Path

try:
    from sec_edgar_downloader import Downloader
except ImportError:  # pragma: no cover - optional dependency at runtime
    Downloader = None

FILING_TYPES = ("10-K", "10-Q", "8-K")


def list_cached_sec_filings(ticker: str, download_folder: str = "sec_data") -> dict[str, list[str]]:
    ticker = ticker.upper()
    base_dir = Path(download_folder) / "sec-edgar-filings" / ticker
    cached_paths = {filing_type: [] for filing_type in FILING_TYPES}

    for filing_type in FILING_TYPES:
        filing_dir = base_dir / filing_type
        if not filing_dir.exists():
            continue

        for accession_dir in sorted(filing_dir.iterdir(), reverse=True):
            file_path = accession_dir / "full-submission.txt"
            if accession_dir.is_dir() and file_path.exists():
                cached_paths[filing_type].append(str(file_path))

    return cached_paths


def fetch_sec_filings(
    ticker: str,
    download_folder: str = "sec_data",
    limit: int = 1,
    download_if_missing: bool = True,
) -> dict[str, list[str]]:
    """
    Returns latest cached SEC filings and optionally downloads missing filing types.
    """
    ticker = ticker.upper()
    cached_paths = list_cached_sec_filings(ticker, download_folder=download_folder)

    if not download_if_missing or all(cached_paths[filing_type] for filing_type in FILING_TYPES):
        return {filing_type: paths[:limit] for filing_type, paths in cached_paths.items()}

    if Downloader is None:
        return {filing_type: paths[:limit] for filing_type, paths in cached_paths.items()}

    company_name = os.getenv("SEC_COMPANY_NAME", "Sentirion")
    contact_email = os.getenv("SEC_CONTACT_EMAIL", "sentirion@example.com")
    downloader = Downloader(company_name, contact_email, download_folder)

    for filing_type in FILING_TYPES:
        if cached_paths[filing_type]:
            continue

        try:
            downloader.get(filing_type, ticker, limit=limit)
        except Exception as exc:  # pragma: no cover - network dependent
            print(f"Error fetching {filing_type} for {ticker}: {exc}")

    cached_paths = list_cached_sec_filings(ticker, download_folder=download_folder)
    return {filing_type: paths[:limit] for filing_type, paths in cached_paths.items()}


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python3 sec_ingestion.py <TICKER>")
        sys.exit(1)

    ticker = sys.argv[1]
    filing_paths = fetch_sec_filings(ticker)

    print("\n--- SEC Filing Summary ---")
    for filing_type, paths in filing_paths.items():
        print(f"{filing_type}: {len(paths)} file(s)")
        for path in paths:
            print(f"  - {path}")

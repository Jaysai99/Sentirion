"use client";

import { useEffect, useState } from "react";

const DEFAULT_QUERY = "AAPL";
const SAMPLE_QUERIES = ["AAPL", "NVDA", "MSFT", "JPM", "semiconductors", "AI infrastructure"];
const TIME_RANGE_OPTIONS = [
  { value: "day", label: "24H" },
  { value: "week", label: "7D" },
  { value: "month", label: "30D" },
  { value: "year", label: "1Y" },
];

async function requestOverview(timeRange) {
  const response = await fetch(`/api/market-overview?reddit_time_range=${encodeURIComponent(timeRange)}`);
  if (!response.ok) {
    throw new Error("Could not load market overview.");
  }
  return response.json();
}

async function requestDeepDive(query, timeRange) {
  const response = await fetch(
    `/api/sentiment/${encodeURIComponent(query)}?include_documents=true&reddit_time_range=${encodeURIComponent(timeRange)}`
  );

  if (!response.ok) {
    let detail = "Sentirion could not return a signal for that search.";
    try {
      const errorPayload = await response.json();
      if (typeof errorPayload?.detail === "string" && errorPayload.detail.trim()) {
        detail = errorPayload.detail;
      }
    } catch {}
    throw new Error(detail);
  }

  return response.json();
}

function formatScore(score) {
  if (typeof score !== "number") return "--";
  return score > 0 ? `+${score.toFixed(2)}` : score.toFixed(2);
}

function formatPercent(value) {
  if (typeof value !== "number") return "--";
  return value > 0 ? `+${value.toFixed(1)}%` : `${value.toFixed(1)}%`;
}

function formatCompactNumber(value) {
  if (typeof value !== "number") return "--";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value) {
  if (!value) return "No timestamp";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No timestamp";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatSourceLabel(source) {
  if (!source) return "Unknown";
  return source === "sec" ? "SEC" : source[0].toUpperCase() + source.slice(1);
}

function getTone(score) {
  if (score >= 0.15) {
    return {
      label: "Bullish",
      accent: "text-[#b8f36b]",
      border: "border-[#b8f36b]/30",
      fill: "#b8f36b",
      bg: "bg-[#b8f36b]/10",
    };
  }
  if (score <= -0.15) {
    return {
      label: "Bearish",
      accent: "text-[#ff7d6b]",
      border: "border-[#ff7d6b]/30",
      fill: "#ff7d6b",
      bg: "bg-[#ff7d6b]/10",
    };
  }
  return {
    label: "Neutral",
    accent: "text-[#ffbf69]",
    border: "border-[#ffbf69]/30",
    fill: "#ffbf69",
    bg: "bg-[#ffbf69]/10",
  };
}

function getAlertStyles(severity) {
  if (severity === "high") {
    return "border-[#ff7d6b]/30 bg-[#ff7d6b]/10 text-[#ffd8d1]";
  }
  if (severity === "medium") {
    return "border-[#ffbf69]/30 bg-[#ffbf69]/10 text-[#f7dfaf]";
  }
  return "border-white/10 bg-white/5 text-[#d5ddd7]";
}

export default function SentimentPage() {
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [redditTimeRange, setRedditTimeRange] = useState("week");
  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeSource, setActiveSource] = useState("all");

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setLoading(true);
      setError("");
      try {
        const payload = await requestDeepDive(DEFAULT_QUERY, "week");
        if (!cancelled) {
          setResult(payload);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Sentirion could not return a signal for that search."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function refreshOverview() {
      setOverviewLoading(true);
      setOverviewError("");
      try {
        const payload = await requestOverview(redditTimeRange);
        if (!cancelled) {
          setOverview(payload);
        }
      } catch (requestError) {
        if (!cancelled) {
          setOverviewError(
            requestError instanceof Error ? requestError.message : "Could not load market overview."
          );
        }
      } finally {
        if (!cancelled) {
          setOverviewLoading(false);
        }
      }
    }

    refreshOverview();
    return () => {
      cancelled = true;
    };
  }, [redditTimeRange]);

  async function runQuery(nextQuery, timeRange = redditTimeRange) {
    const normalizedQuery = nextQuery.trim();
    if (!normalizedQuery) return;

    setLoading(true);
    setError("");
    setActiveSource("all");

    try {
      const payload = await requestDeepDive(normalizedQuery, timeRange);
      setResult(payload);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Sentirion could not return a signal for that search."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    runQuery(query);
  }

  const scoreTone = getTone(result?.score ?? 0);
  const displayScore = result?.score_display;
  const displayedDocuments =
    activeSource === "all"
      ? result?.documents || []
      : (result?.documents || []).filter((document) => document.source === activeSource);

  return (
    <main className="sentirion-grid min-h-screen px-4 py-5 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-5">
        <header className="glass-panel dashboard-fade rounded-[30px] px-6 py-5">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#76867f]">
                    Sentirion
                  </div>
                  <div className="h-1 w-1 rounded-full bg-[#b8f36b]" />
                  <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#76867f]">
                    Sentiment Intelligence Terminal
                  </div>
                </div>
                {result?.ticker || result?.stock_data ? (
                  <div className="mt-2 flex items-end gap-4">
                    <span className="text-4xl font-semibold tracking-[-0.06em] text-[#f4f0e8] sm:text-5xl">
                      {result?.stock_data?.ticker || result?.ticker || query}
                    </span>
                    {result?.stock_data?.company_name && (
                      <span className="mb-1 text-base text-[#7a8f85]">
                        {result.stock_data.company_name}
                      </span>
                    )}
                  </div>
                ) : (
                  <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[#f4f0e8] sm:text-4xl">
                    Market Sentiment Terminal
                  </h1>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:w-[560px]">
              <StatChip
                label="Score"
                value={
                  result?.score_display != null
                    ? formatScore(result.score_display)
                    : result?.signal_quality
                    ? "LOW COV"
                    : "--"
                }
                accent={result?.score_display != null ? getTone(result.score_display).accent : "text-[#f4f0e8]"}
              />
              <StatChip
                label="Signal"
                value={result?.signal_quality?.confidence_label || "--"}
              />
              <StatChip
                label="Docs"
                value={result?.coverage?.documents_analyzed ?? "--"}
              />
              <StatChip
                label="Confidence"
                value={
                  result?.signal_quality
                    ? `${result.signal_quality.confidence_score.toFixed(0)}/100`
                    : "--"
                }
              />
            </div>
          </div>
        </header>

        <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <Panel title="Query Console" eyebrow="Input">
            <form className="flex flex-col gap-3 xl:flex-row" onSubmit={handleSubmit}>
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search a ticker or market narrative"
                className="min-w-0 flex-1 rounded-[18px] border border-white/10 bg-[#0c1916] px-5 py-4 text-base text-white outline-none transition placeholder:text-[#5f7269] focus:border-[#b8f36b]/60"
                required
              />
              <button
                type="submit"
                disabled={loading}
                className="rounded-[18px] bg-[#b8f36b] px-6 py-4 text-sm font-semibold uppercase tracking-[0.24em] text-[#09110f] transition hover:bg-[#d3ff98] disabled:opacity-60"
              >
                {loading ? "Scanning" : "Run Query"}
              </button>
            </form>

            <div className="mt-4 flex flex-wrap gap-2">
              {TIME_RANGE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setRedditTimeRange(option.value)}
                  className={`rounded-full px-3 py-2 text-sm transition ${
                    redditTimeRange === option.value
                      ? "bg-[#ffbf69] text-[#09110f]"
                      : "border border-white/10 bg-white/5 text-[#d8dfd6] hover:border-[#ffbf69]/40 hover:bg-[#ffbf69]/10"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {SAMPLE_QUERIES.map((sample) => (
                <button
                  key={sample}
                  type="button"
                  onClick={() => {
                    setQuery(sample);
                    runQuery(sample);
                  }}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-[#d8dfd6] transition hover:border-[#b8f36b]/30 hover:bg-[#b8f36b]/10 hover:text-white"
                >
                  {sample}
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Signal Quality" eyebrow="Priority 1">
            <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <div className={`rounded-[22px] border ${scoreTone.border} ${scoreTone.bg} p-5`}>
                <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#76867f]">
                  Current Read
                </div>
                <div className={`mt-3 text-6xl font-semibold tracking-[-0.08em] ${scoreTone.accent}`}>
                  {displayScore === null || displayScore === undefined ? "LOW" : formatScore(displayScore)}
                </div>
                <div className="mt-2 text-sm text-[#d8dfd6]">
                  {displayScore === null || displayScore === undefined
                    ? "Coverage below institutional threshold"
                    : scoreTone.label}
                </div>
                <div className="mt-4 text-sm leading-7 text-[#a5b4ac]">
                  {result?.signal_quality?.coverage_warning || result?.coverage?.coverage_label}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <MetricCard
                  label="Coverage"
                  value={result?.coverage?.coverage_label || "--"}
                  caption="Document scale and source breadth"
                />
                <MetricCard
                  label="Confidence"
                  value={
                    result?.signal_quality
                      ? `${result.signal_quality.confidence_score.toFixed(0)} / 100`
                      : "--"
                  }
                  caption={
                    result?.signal_quality?.coverage_ratio !== undefined
                      ? `Volume-capped model · coverage ${(result.signal_quality.coverage_ratio * 100).toFixed(0)}%`
                      : "Volume, agreement, and recency"
                  }
                />
                <MetricCard
                  label="Volume Score"
                  value={
                    result?.signal_quality?.volume_score !== undefined
                      ? result.signal_quality.volume_score.toFixed(2)
                      : "--"
                  }
                  caption="Coverage strength vs threshold"
                />
                <MetricCard
                  label="Agreement"
                  value={
                    result?.signal_quality?.agreement_score !== undefined
                      ? result.signal_quality.agreement_score.toFixed(2)
                      : "--"
                  }
                  caption="Cross-source consistency"
                />
              </div>
            </div>
          </Panel>
        </section>

        {result?.stock_data && (
          <section>
            <Panel title="Financial Snapshot" eyebrow="Market Data">
              <FinancialSnapshot data={result.stock_data} />
            </Panel>
          </section>
        )}

        <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <Panel title="Narrative Engine" eyebrow="Priority 2">
            <div className="space-y-4">
              <div className="rounded-[22px] border border-white/8 bg-[#0b1714] p-5">
                <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#76867f]">
                  Why Sentiment Is Moving
                </div>
                <div className="mt-3 text-lg leading-8 text-[#f1f4ef]">
                  {result?.narrative_engine?.summary || "Run a query to generate a narrative."}
                </div>
              </div>
              <div className="rounded-[22px] border border-white/8 bg-[#0b1714] p-5">
                <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#76867f]">
                  So What
                </div>
                <div className="mt-3 text-base leading-8 text-[#b9c5bf]">
                  {result?.narrative_engine?.actionable_interpretation ||
                    "Actionable interpretation appears here when data is available."}
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="Catalysts" eyebrow="Priority 3">
            <div className="space-y-3">
              {(result?.catalysts || []).map((catalyst) => (
                <div key={catalyst} className="rounded-[20px] border border-white/8 bg-[#0b1714] p-4 text-sm leading-7 text-[#dbe3dd]">
                  {catalyst}
                </div>
              ))}
              <div className="rounded-[20px] border border-white/8 bg-[#0b1714] p-4">
                <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#76867f]">
                  Divergence Signal
                </div>
                <div className="mt-3 text-base text-[#f4f0e8]">
                  {result?.divergence_signal?.message || "No divergence signal available."}
                </div>
                <div className="mt-2 text-sm text-[#93a49c]">
                  Spread:{" "}
                  {result?.divergence_signal?.spread === null || result?.divergence_signal?.spread === undefined
                    ? "N/A"
                    : formatScore(result.divergence_signal.spread)}
                </div>
              </div>
            </div>
          </Panel>
        </section>

        <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <Panel title="Momentum & Trend" eyebrow="Priority 4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Δ 1H"
                value={formatScore(result?.momentum?.delta_1h || 0)}
                caption="Immediate sentiment move"
              />
              <MetricCard
                label="Δ 6H"
                value={formatScore(result?.momentum?.delta_6h || 0)}
                caption="Short-term shift"
              />
              <MetricCard
                label="Δ 24H"
                value={formatScore(result?.momentum?.delta_24h || 0)}
                caption="Daily change"
              />
              <MetricCard
                label="Trend"
                value={result?.momentum?.trend || "--"}
                caption={
                  result?.momentum?.inflection_detected
                    ? "Recent inflection detected"
                    : "Current trend classification"
                }
              />
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <MiniMetric
                label="Acceleration"
                value={formatScore(result?.momentum?.acceleration || 0)}
              />
              <MiniMetric
                label="Regime Shift"
                value={result?.momentum?.regime_shift || "none"}
              />
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_1fr]">
              <div className="rounded-[22px] border border-white/8 bg-[#0b1714] p-4">
                <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#76867f]">
                  Historical Positioning
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <MiniMetric
                    label="Z-Score"
                    value={
                      result?.historical_positioning?.z_score === null || result?.historical_positioning?.z_score === undefined
                        ? "N/A"
                        : result.historical_positioning.z_score
                    }
                  />
                  <MiniMetric
                    label="Percentile"
                    value={
                      result?.historical_positioning?.percentile === null || result?.historical_positioning?.percentile === undefined
                        ? "N/A"
                        : `${result.historical_positioning.percentile}%`
                    }
                  />
                </div>
              </div>

              <div className="rounded-[22px] border border-white/8 bg-[#0b1714] p-4">
                <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#76867f]">
                  Alert Stack
                </div>
                <div className="mt-3 space-y-3">
                  {(result?.signal_analytics?.alerts || []).length === 0 ? (
                    <div className="text-sm text-[#93a49c]">No active alerts.</div>
                  ) : (
                    (result?.signal_analytics?.alerts || []).map((alert) => (
                      <div
                        key={`${alert.title}-${alert.description}`}
                        className={`rounded-[18px] border px-4 py-3 text-sm ${getAlertStyles(alert.severity)}`}
                      >
                        <div className="font-medium">{alert.title}</div>
                        <div className="mt-1 leading-6">{alert.description}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="Top Drivers" eyebrow="Priority 5">
            <div className="space-y-3">
              {(result?.top_drivers || []).map((driver, index) => (
                <div key={`${driver.source}-${index}`} className="rounded-[22px] border border-white/8 bg-[#0b1714] p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.22em] text-[#9eb0a7]">
                      {formatSourceLabel(driver.source)}
                    </span>
                    <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-[#d6ddd7]">
                      {driver.document_type}
                    </span>
                    <span className={getTone(driver.sentiment_score).accent}>
                      {formatScore(driver.sentiment_score)}
                    </span>
                    <span className="text-xs text-[#7a8c84]">impact {driver.impact_score}</span>
                    <span className="text-xs text-[#7a8c84]">{driver.driver_topic || "flow"}</span>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-[#edf1ec]">{driver.snippet}</p>
                  <div className="mt-3 text-sm leading-6 text-[#9aaba3]">{driver.why_it_matters}</div>
                </div>
              ))}
            </div>
          </Panel>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <Panel title="Global Market Overview" eyebrow="Market Context">
            {overviewError ? <ErrorStrip message={overviewError} /> : null}
            {overviewLoading ? (
              <LoadingGrid />
            ) : (
              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                  {(overview?.indices || []).map((index) => {
                    const isVix = index.name === "VIX";
                    const isYield = index.name === "10Y Yield";
                    const changeRatio = (index.change_pct || 0) / 100;
                    const colorTone = isVix
                      ? getTone(-changeRatio)
                      : getTone(changeRatio);
                    return (
                      <div key={index.symbol} className="rounded-[22px] border border-white/8 bg-[#0b1714] p-4">
                        <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#76867f]">
                          {index.name}
                        </div>
                        <div className="mt-2">
                          <div className="text-xl font-semibold tracking-[-0.04em] text-[#f4f0e8]">
                            {isYield
                              ? `${index.price?.toFixed(2)}%`
                              : formatCompactNumber(index.price)}
                          </div>
                          <div className={`text-sm ${colorTone.accent}`}>
                            {formatPercent(index.change_pct)}
                          </div>
                        </div>
                        <MiniLineChart
                          points={index.history || []}
                          valueKey="close"
                          stroke={isVix ? "#ff7d6b" : isYield ? "#ffbf69" : "#b8f36b"}
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="rounded-[22px] border border-white/8 bg-[#0b1714] p-4">
                  <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.24em] text-[#76867f]">
                    Watchlist
                  </div>
                  <WatchlistTable entries={overview?.top_traded_tickers || []} />
                </div>

                <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
                  <div className="rounded-[22px] border border-white/8 bg-[#0b1714] p-4">
                    <div className="mb-4 font-mono text-[11px] uppercase tracking-[0.24em] text-[#76867f]">
                      Sentiment Distribution
                    </div>
                    <Histogram buckets={overview?.sentiment_distribution || []} />
                  </div>
                  <div className="rounded-[22px] border border-white/8 bg-[#0b1714] p-4">
                    <div className="mb-4 font-mono text-[11px] uppercase tracking-[0.24em] text-[#76867f]">
                      Relative Heatmap
                    </div>
                    <Heatmap entries={overview?.heatmap || []} />
                  </div>
                </div>
              </div>
            )}
          </Panel>

          <Panel title="Price & Sentiment Trend" eyebrow="Deep Dive">
            <div className="space-y-4">
              <div className="rounded-[22px] border border-white/8 bg-[#0b1714] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#76867f]">
                    Sentiment Timeline
                  </div>
                  <div className={scoreTone.accent}>
                    {displayScore == null ? "Low Coverage" : formatScore(displayScore)}
                  </div>
                </div>
                <LineChart points={result?.sentiment_timeline || []} valueKey="score" labelKey="bucket" stroke={scoreTone.fill} />
              </div>

              {result?.stock_data?.historical_performance?.length > 0 && (
                <div className="rounded-[22px] border border-white/8 bg-[#0b1714] p-4">
                  <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.24em] text-[#76867f]">
                    180-Day Price Chart
                  </div>
                  <LineChart
                    points={result.stock_data.historical_performance}
                    valueKey="close"
                    labelKey="date"
                    stroke="#7fd0ff"
                  />
                </div>
              )}
            </div>
          </Panel>
        </section>

        <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <Panel title="Filings Intelligence" eyebrow="High-Quality Source">
            <div className="space-y-4">
              {(result?.filings_intelligence?.filings || []).length === 0 ? (
                <div className="rounded-[22px] border border-white/8 bg-[#0b1714] p-5 text-sm leading-7 text-[#8fa199]">
                  SEC filing intelligence appears for valid stock tickers when local EDGAR filings are available.
                </div>
              ) : (
                (result?.filings_intelligence?.filings || []).map((filing) => (
                  <div key={`${filing.filing_type}-${filing.filed_at}`} className="rounded-[22px] border border-white/8 bg-[#0b1714] p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-[#f4f0e8]">{filing.filing_type}</div>
                      <div className={getTone(filing.avg_sentiment).accent}>{formatScore(filing.avg_sentiment)}</div>
                    </div>
                    <div className="mt-2 text-sm text-[#8fa199]">
                      Filed {formatDate(filing.filed_at)} · {filing.section_count} sections · {filing.tone_change_label}
                      {" · "}
                      Δ vs previous {filing.change_vs_previous === null ? "N/A" : formatScore(filing.change_vs_previous)}
                    </div>
                  </div>
                ))
              )}

              <div className="rounded-[22px] border border-white/8 bg-[#0b1714] p-4">
                <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.24em] text-[#76867f]">
                  Highest-Impact Filing Sections
                </div>
                <div className="space-y-3">
                  {(result?.filings_intelligence?.key_sections || []).map((section, index) => (
                    <div key={`${section.document_type}-${index}`} className="rounded-[18px] border border-white/8 bg-black/20 p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-[#edf1ea]">
                          {section.section_theme} · {section.document_type}
                        </div>
                        <div className={getTone(section.sentiment_score).accent}>
                          {formatScore(section.sentiment_score)}
                        </div>
                      </div>
                      {section.section_heading ? (
                        <div className="mt-2 text-xs uppercase tracking-[0.18em] text-[#7f9288]">
                          {section.section_heading}
                        </div>
                      ) : null}
                      <div className="mt-2 text-sm leading-7 text-[#b7c4be]">{section.snippet}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="Raw Stream" eyebrow="Lower Priority Data">
            <div className="flex flex-wrap gap-2">
              {["all", "reddit", "sec"].map((source) => (
                <button
                  key={source}
                  type="button"
                  onClick={() => setActiveSource(source)}
                  className={`rounded-full px-4 py-2 text-sm transition ${
                    activeSource === source
                      ? "bg-[#b8f36b] text-[#09110f]"
                      : "border border-white/10 bg-white/5 text-[#ced8d1] hover:border-[#b8f36b]/30 hover:bg-[#b8f36b]/10"
                  }`}
                >
                  {source === "all" ? "All Sources" : formatSourceLabel(source)}
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <MiniMetric label="Mentions" value={result?.signal_analytics?.mention_volume || 0} />
              <MiniMetric
                label="Volume Surge"
                value={formatPercent(result?.signal_analytics?.volume_change_pct)}
              />
              <MiniMetric label="Dispersion" value={result?.signal_analytics?.dispersion ?? "--"} />
            </div>

            <div className="mt-5 space-y-3">
              {displayedDocuments.length === 0 ? (
                <div className="rounded-[22px] border border-white/8 bg-[#0b1714] p-5 text-sm leading-7 text-[#8fa199]">
                  No documents matched this filter.
                </div>
              ) : null}
              {displayedDocuments.slice(0, 12).map((document, index) => (
                <article
                  key={`${document.source}-${document.document_type}-${index}`}
                  className="rounded-[22px] border border-white/8 bg-[#0b1714] p-4"
                >
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.22em] text-[#9eb0a7]">
                          {formatSourceLabel(document.source)}
                        </span>
                        <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-[#d6ddd7]">
                          {document.document_type}
                        </span>
                        <span className="text-xs text-[#7f9288]">
                          {document.source === "reddit"
                            ? document.metadata?.subreddit
                              ? `r/${document.metadata.subreddit}`
                              : "Public discussion"
                            : formatDate(document.metadata?.filed_at)}
                        </span>
                      </div>
                      <p className="max-w-4xl text-sm leading-7 text-[#ecf1ec]">{document.snippet}</p>
                    </div>
                    <div className="min-w-[132px] rounded-[20px] border border-white/8 bg-black/20 px-4 py-3 xl:text-right">
                      <div className={`text-2xl font-semibold tracking-[-0.05em] ${getTone(document.sentiment_score).accent}`}>
                        {formatScore(document.sentiment_score)}
                      </div>
                      <div className="mt-1 text-xs uppercase tracking-[0.18em] text-[#8ea097]">
                        {document.label}
                      </div>
                      <div className="mt-2 font-mono text-[11px] text-[#71847b]">
                        {formatDate(document.metadata?.created_at || document.metadata?.filed_at)}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </Panel>
        </section>

        {error ? <ErrorStrip message={error} /> : null}
      </div>
    </main>
  );
}

function Panel({ eyebrow, title, children }) {
  return (
    <section className="glass-panel dashboard-fade rounded-[28px] p-5 sm:p-6">
      <div className="mb-4">
        <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#72857c]">{eyebrow}</div>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#f4f0e8]">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function StatChip({ label, value, accent }) {
  return (
    <div className="rounded-[20px] border border-white/8 bg-white/[0.04] px-4 py-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#72857c]">{label}</div>
      <div className={`mt-2 text-lg font-semibold tracking-[-0.03em] ${accent || "text-[#f4f0e8]"}`}>{value}</div>
    </div>
  );
}

function MetricCard({ label, value, caption }) {
  return (
    <div className="rounded-[20px] border border-white/8 bg-[#0b1714] p-4">
      <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#72857c]">{label}</div>
      <div className="mt-3 text-2xl font-semibold tracking-[-0.05em] text-[#f4f0e8]">{value}</div>
      <div className="mt-2 text-sm leading-6 text-[#93a49c]">{caption}</div>
    </div>
  );
}

function MiniMetric({ label, value }) {
  return (
    <div className="rounded-[18px] border border-white/8 bg-[#0b1714] p-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#70827a]">{label}</div>
      <div className="mt-2 text-lg font-semibold tracking-[-0.04em] text-[#f4f0e8]">{value}</div>
    </div>
  );
}

function ErrorStrip({ message }) {
  return (
    <div className="glass-panel dashboard-fade rounded-[24px] border border-[#ff7d6b]/20 px-6 py-4 text-sm text-[#ffd4ce]">
      {message}
    </div>
  );
}

function LoadingGrid() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {[0, 1, 2].map((index) => (
        <div key={index} className="h-36 animate-pulse rounded-[22px] bg-white/[0.04]" />
      ))}
    </div>
  );
}

function MiniLineChart({ points, valueKey, stroke }) {
  if (!points?.length) return <div className="h-16 w-28 rounded-[12px] bg-white/[0.04]" />;

  const values = points.map((point) => point[valueKey]).filter((value) => typeof value === "number");
  if (!values.length) return <div className="h-16 w-28 rounded-[12px] bg-white/[0.04]" />;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const path = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * 110;
      const y = max === min ? 28 : 56 - ((value - min) / (max - min)) * 48;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 110 60" className="h-16 w-28">
      <path d={path} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function LineChart({ points, valueKey, labelKey, stroke }) {
  if (!points?.length) return <div className="h-48 rounded-[18px] bg-white/[0.04]" />;

  const values = points.map((point) => point[valueKey]).filter((value) => typeof value === "number");
  if (!values.length) return <div className="h-48 rounded-[18px] bg-white/[0.04]" />;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const path = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * 580;
      const y = max === min ? 90 : 180 - ((value - min) / (max - min)) * 150;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  const firstLabel = points[0]?.[labelKey];
  const lastLabel = points[points.length - 1]?.[labelKey];

  return (
    <div>
      <svg viewBox="0 0 580 190" className="h-48 w-full">
        <path d={path} fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
      </svg>
      <div className="mt-2 flex items-center justify-between text-xs text-[#7d8f87]">
        <span>{firstLabel}</span>
        <span>{lastLabel}</span>
      </div>
    </div>
  );
}

function Histogram({ buckets }) {
  const maxCount = Math.max(...(buckets.map((bucket) => bucket.count) || [1]), 1);

  return (
    <div className="flex items-end gap-3">
      {buckets.map((bucket) => (
        <div key={bucket.label} className="flex flex-1 flex-col items-center gap-2">
          <div
            className="w-full rounded-t-[12px] bg-gradient-to-t from-[#b8f36b] to-[#ffbf69]"
            style={{ height: `${Math.max((bucket.count / maxCount) * 120, 8)}px` }}
          />
          <div className="text-center text-[11px] text-[#82938b]">{bucket.label}</div>
        </div>
      ))}
    </div>
  );
}

function Heatmap({ entries }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      {entries.map((entry) => {
        const tone = getTone(entry.sentiment_score);
        const muted = entry.signal_visible === false;
        return (
          <div
            key={entry.ticker}
            className={`rounded-[18px] border p-3 ${
              muted ? "border-white/8 bg-white/[0.03]" : `${tone.border} ${tone.bg}`
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-[#f4f0e8]">{entry.ticker}</div>
                <div className="mt-0.5 text-xs text-[#7b8c84]">{entry.sector || "Unknown"}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-[#f4f0e8]">
                  {entry.price ? `$${entry.price.toLocaleString()}` : "--"}
                </div>
                <div className={`text-xs ${getTone((entry.price_change_pct || 0) / 100).accent}`}>
                  {formatPercent(entry.price_change_pct)}
                </div>
              </div>
            </div>
            <div className="mt-2 flex items-end justify-between">
              <div
                className={`text-xl font-semibold tracking-[-0.05em] ${
                  muted ? "text-[#93a49c]" : tone.accent
                }`}
              >
                {muted ? "Thin" : formatScore(entry.sentiment_score)}
              </div>
              <div className="text-right text-xs text-[#7b8c84]">
                <div>{entry.mentions} mentions</div>
                {entry.market_cap && <div>MCap {formatCompactNumber(entry.market_cap)}</div>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WatchlistTable({ entries }) {
  if (!entries?.length) return <div className="text-sm text-[#8fa199]">No watchlist data.</div>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/8">
            {["Ticker", "Company", "Price", "Chg%", "MCap", "Sentiment", "Signal", "Mentions"].map((h) => (
              <th key={h} className="pb-2 pr-4 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-[#70827a]">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const tone = getTone(entry.sentiment_score);
            const muted = !entry.signal_visible;
            return (
              <tr key={entry.ticker} className="border-b border-white/4 hover:bg-white/[0.02]">
                <td className="py-2 pr-4 font-mono text-[#f4f0e8]">{entry.ticker}</td>
                <td className="py-2 pr-4 text-xs text-[#8fa199] max-w-[120px] truncate">{entry.company_name}</td>
                <td className="py-2 pr-4 font-mono text-[#f4f0e8]">
                  {entry.price != null ? `$${entry.price.toLocaleString()}` : "--"}
                </td>
                <td className={`py-2 pr-4 font-mono ${getTone((entry.price_change_pct || 0) / 100).accent}`}>
                  {formatPercent(entry.price_change_pct)}
                </td>
                <td className="py-2 pr-4 font-mono text-[#9aaba3]">
                  {formatCompactNumber(entry.market_cap)}
                </td>
                <td className={`py-2 pr-4 font-mono font-semibold ${muted ? "text-[#93a49c]" : tone.accent}`}>
                  {muted ? "Thin" : formatScore(entry.sentiment_score)}
                </td>
                <td className={`py-2 pr-4 text-xs ${muted ? "text-[#93a49c]" : tone.accent}`}>
                  {muted ? "--" : tone.label}
                </td>
                <td className="py-2 font-mono text-xs text-[#7b8c84]">{entry.mentions}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FinancialSnapshot({ data }) {
  const perf = data.performance_summary || {};
  const metrics = [
    { label: "Market Cap", value: formatCompactNumber(data.market_cap) },
    { label: "Volume", value: formatCompactNumber(data.current_volume) },
    { label: "Avg Vol", value: formatCompactNumber(data.average_volume) },
    { label: "Fwd P/E", value: data.forward_pe != null ? data.forward_pe.toFixed(1) : "--" },
    { label: "P/E (TTM)", value: data.trailing_pe != null ? data.trailing_pe.toFixed(1) : "--" },
    { label: "Beta", value: data.beta != null ? data.beta.toFixed(2) : "--" },
    { label: "52W High", value: data.year_high != null ? `$${data.year_high.toLocaleString()}` : "--" },
    { label: "52W Low", value: data.year_low != null ? `$${data.year_low.toLocaleString()}` : "--" },
    { label: "Yield", value: data.dividend_yield != null ? `${(data.dividend_yield * 100).toFixed(2)}%` : "--" },
  ];

  const perfItems = [
    { label: "1W", value: perf["1w"] },
    { label: "1M", value: perf["1m"] },
    { label: "3M", value: perf["3m"] },
    { label: "6M", value: perf["6m"] },
  ];

  const yearRange = data.year_high && data.year_low && data.price
    ? Math.min(Math.max((data.price - data.year_low) / (data.year_high - data.year_low), 0), 1)
    : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[22px] border border-white/8 bg-[#0b1714] p-5">
        <div>
          <div className="text-2xl font-semibold tracking-[-0.03em] text-[#f4f0e8]">
            {data.company_name}
          </div>
          <div className="mt-1 font-mono text-xs uppercase tracking-[0.18em] text-[#76867f]">
            {data.ticker}
            {data.sector ? ` · ${data.sector}` : ""}
            {data.industry ? ` · ${data.industry}` : ""}
          </div>
        </div>
        <div className="text-right">
          <div className="text-4xl font-semibold tracking-[-0.06em] text-[#f4f0e8]">
            {data.price != null ? `$${data.price.toLocaleString()}` : "--"}
          </div>
          <div className={`mt-1 text-base ${getTone((data.price_change_pct || 0) / 100).accent}`}>
            {formatPercent(data.price_change_pct)} today
          </div>
        </div>
      </div>

      {yearRange !== null && (
        <div className="rounded-[22px] border border-white/8 bg-[#0b1714] px-5 py-4">
          <div className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.22em] text-[#70827a]">
            <span>52W Low ${data.year_low?.toLocaleString()}</span>
            <span>52-Week Range</span>
            <span>52W High ${data.year_high?.toLocaleString()}</span>
          </div>
          <div className="relative h-2 rounded-full bg-white/8">
            <div
              className="absolute left-0 top-0 h-2 rounded-full bg-gradient-to-r from-[#ff7d6b] via-[#ffbf69] to-[#b8f36b]"
              style={{ width: `${yearRange * 100}%` }}
            />
            <div
              className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 rounded-full bg-white"
              style={{ left: `${yearRange * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
        {metrics.map(({ label, value }) => (
          <div key={label} className="rounded-[16px] border border-white/8 bg-[#0b1714] p-3">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#70827a]">{label}</div>
            <div className="mt-1.5 text-sm font-semibold text-[#f4f0e8]">{value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-[22px] border border-white/8 bg-[#0b1714] p-4">
        <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.24em] text-[#76867f]">
          Price Return
        </div>
        <div className="grid grid-cols-4 gap-3">
          {perfItems.map(({ label, value }) => {
            const tone = value == null ? null : getTone(value / 100);
            return (
              <div key={label} className="text-center">
                <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#70827a]">{label}</div>
                <div className={`mt-1.5 text-xl font-semibold tracking-[-0.04em] ${tone ? tone.accent : "text-[#93a49c]"}`}>
                  {value == null ? "--" : formatPercent(value)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {(data.revenue_series?.length > 0 || data.income_series?.length > 0) && (
        <div className="grid gap-4 xl:grid-cols-2">
          {data.revenue_series?.length > 0 && (
            <div className="rounded-[22px] border border-white/8 bg-[#0b1714] p-4">
              <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.24em] text-[#76867f]">
                Revenue — Quarterly
              </div>
              <BarChart series={data.revenue_series} color="#7fd0ff" />
            </div>
          )}
          {data.income_series?.length > 0 && (
            <div className="rounded-[22px] border border-white/8 bg-[#0b1714] p-4">
              <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.24em] text-[#76867f]">
                Net Income — Quarterly
              </div>
              <BarChart series={data.income_series} color="#b8f36b" />
            </div>
          )}
        </div>
      )}

      {data.business_summary && (
        <div className="rounded-[22px] border border-white/8 bg-[#0b1714] p-4">
          <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.24em] text-[#76867f]">
            Business Summary
          </div>
          <p className="text-sm leading-7 text-[#9aaba3] line-clamp-3">{data.business_summary}</p>
        </div>
      )}
    </div>
  );
}

function BarChart({ series, color }) {
  if (!series?.length) return null;

  const values = series.map((s) => s.value);
  const maxAbs = Math.max(...values.map((v) => Math.abs(v)), 1);
  const BAR_HEIGHT = 80;

  return (
    <div className="flex items-end gap-1.5" style={{ height: `${BAR_HEIGHT + 40}px` }}>
      {series.map((point, i) => {
        const ratio = Math.abs(point.value) / maxAbs;
        const height = Math.max(ratio * BAR_HEIGHT, 4);
        const isNeg = point.value < 0;
        const barColor = isNeg ? "#ff7d6b" : color;
        const label = point.period_end?.slice(0, 7) ?? "";

        return (
          <div
            key={i}
            className="flex flex-1 flex-col items-center gap-1"
            style={{ height: `${BAR_HEIGHT + 40}px`, justifyContent: "flex-end" }}
          >
            <div className="font-mono text-[9px] text-[#70827a]">{formatCompactNumber(point.value)}</div>
            <div
              style={{
                height: `${height}px`,
                backgroundColor: barColor,
                opacity: 0.75,
                width: "100%",
                borderRadius: "3px 3px 0 0",
              }}
            />
            <div className="font-mono text-[9px] text-[#70827a] text-center leading-tight">{label}</div>
          </div>
        );
      })}
    </div>
  );
}

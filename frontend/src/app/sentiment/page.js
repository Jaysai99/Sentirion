"use client";
import { useState } from "react";

export default function SentimentPage() {
  const [ticker, setTicker] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError("");
    try {
      const res = await fetch(`https://sentirion.net/api/sentiment/${ticker}`);
      if (!res.ok) throw new Error("No sentiment found for this ticker.");
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError("Could not fetch sentiment. Try another ticker.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#0f2027] via-[#2c5364] to-[#232526] px-4">
      <div className="w-full max-w-md mx-auto flex flex-col items-center">
        <div className="mb-10 mt-8 flex flex-col items-center">
          <h1 className="text-4xl font-extrabold text-white mb-2 text-center tracking-tight">
            Stock Sentiment
          </h1>
          <p className="text-[#b2bec3] text-lg text-center max-w-xs">
            Enter a stock ticker to see how the market feels about it right now.
          </p>
        </div>
        <form
          onSubmit={handleSubmit}
          className="flex flex-col items-center gap-4 w-full bg-white/10 backdrop-blur-md rounded-2xl shadow-xl p-8 border border-white/10"
        >
          <input
            type="text"
            required
            placeholder="Stock ticker (e.g. PLTR)"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            className="px-5 py-3 rounded-xl bg-[#232526] text-white border-2 border-[#00cec9] focus:outline-none focus:border-[#0984e3] w-full text-lg font-semibold placeholder-[#b2bec3] transition"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 rounded-full bg-[#00cec9] text-white font-bold text-lg shadow-lg hover:bg-[#0984e3] transition w-full"
          >
            {loading ? (
              <span className="animate-pulse">Checking...</span>
            ) : (
              "Check Sentiment"
            )}
          </button>
        </form>
        {result && (
          <div className="mt-10 w-full bg-white/10 backdrop-blur-md rounded-2xl shadow-xl p-8 border border-white/10 flex flex-col items-center">
            <h2 className="text-xl font-bold text-white mb-2">
              Sentiment for{" "}
              <span className="text-[#00cec9]">{result.ticker}</span>
            </h2>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-5xl font-extrabold text-[#00cec9]">
                {result.score}
              </span>
              <span
                className={`text-lg font-bold ${
                  Number(result.score) > 0.3
                    ? "text-green-400"
                    : Number(result.score) < -0.3
                    ? "text-red-400"
                    : "text-yellow-300"
                }`}
              >
                {Number(result.score) > 0.3
                  ? "Positive"
                  : Number(result.score) < -0.3
                  ? "Negative"
                  : "Neutral"}
              </span>
            </div>
            <div className="text-[#b2bec3] text-base text-center mb-2">
              {result.explanation}
            </div>
            <div className="text-[#636e72] text-sm text-center">
              Based on recent Reddit posts and comments.
            </div>
          </div>
        )}
        {error && (
          <div className="mt-8 text-[#d63031] text-center font-semibold bg-white/10 rounded-xl px-4 py-2">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

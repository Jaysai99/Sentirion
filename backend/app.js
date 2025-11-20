import dotenv from "dotenv";
dotenv.config();
import express, { json } from "express";
import fetch from "node-fetch";
import OpenAI from "openai";
import cors from "cors";

const app = express();
app.use(cors());
app.use(json());

// OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// --- Helper: fetch Reddit posts ---
async function fetchRedditContent(ticker) {
  const subreddits = [
    "stocks",
    "wallstreetbets",
    "investing",
    "StockMarket",
    "pennystocks",
    "RobinHood",
    "Daytrading",
    "Finance",
    "Economics",
  ];
  let texts = [];

  function trimPost(text, maxChars = 400) {
    if (!text) return "";
    return text.length > maxChars ? text.slice(0, maxChars) + "..." : text;
  }

  for (const sub of subreddits) {
    const url = `https://www.reddit.com/r/${sub}/search.json?q=${ticker}&restrict_sr=1&sort=new&limit=10`;
    const res = await fetch(url, { headers: { "User-Agent": "sentirion-bot" } });
    const data = await res.json();
    if (data?.data?.children) {
      texts.push(
        ...data.data.children.map((post) =>
          trimPost(post.data.title + " " + (post.data.selftext || ""))
        )
      );
    }
  }
  return texts;
}

// --- Helper: extract text from completion ---
function extractCompletionText(completion) {
  return completion?.choices?.[0]?.message?.content?.trim() || null;
}

// --- Helper: ask OpenAI for sentiment ---
async function getSentimentScore(ticker, texts) {
  const prompt = `
You are given posts about ${ticker}. Output ONE sentiment score between -1 (negative) and 1 (positive).
Format:
Score: <number with 2 decimals>
Explanation: <1-2 sentences>

Posts:
${texts.map((t, i) => `${i + 1}. ${t}`).join("\n")}
`;

  const options = {
    model: "gpt-4.1-mini",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 300,
    temperature: 0,
  };

  const completion = await openai.chat.completions.create(options);

  let content = extractCompletionText(completion);

  if (!content) {
    console.warn("Empty response, retrying with fewer posts...");
    if (texts.length > 3) {
      return await getSentimentScore(ticker, texts.slice(0, 3));
    }
    throw new Error("No response from OpenAI or unexpected response format.");
  }

  // Parse score & explanation
  const scoreMatch = content.match(/Score:\s*([+-]?\d+(?:\.\d+)?)/i);
  const explanationMatch = content.match(/Explanation:\s*(.+)/i);

  let score = scoreMatch ? parseFloat(scoreMatch[1]) : NaN;
  const explanation = explanationMatch ? explanationMatch[1].trim() : "No explanation provided.";

  if (!Number.isFinite(score)) {
    console.error("Could not parse score. Content was:\n", content);
    throw new Error("Parsing failed: score missing");
  }

  // Force 2 decimal precision
  score = parseFloat(score.toFixed(2));

  return { score, explanation };
}

// --- API route ---
app.get("/api/sentiment/:ticker", async (req, res) => {
  try {
    const ticker = req.params.ticker.toUpperCase();
    console.log("Ticker:", ticker);

    let texts = await fetchRedditContent(ticker);
    console.log("Number of posts fetched:", texts.length);

    if (!texts.length) {
      return res.status(404).json({ error: "No Reddit posts found." });
    }

    const { score, explanation } = await getSentimentScore(ticker, texts);
    console.log("Sentiment score:", score);

    // ✅ Algo-friendly JSON
    res.json({
      ticker,
      score, // 2 decimals
      explanation,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Error in /api/sentiment route:", err.message || err);
    res.status(500).json({ error: "Failed to fetch sentiment." });
  }
});

// --- Start server ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});

Sentirion - Real-Time Market Sentiment API

Sentirion is a Node.js + Express backend that scrapes Reddit threads and makes a sentiment score for any stock ticker using OpenAI’s API.

Current Features-
Scrapes financial subreddits (e.g., stocks, wallstreetbets, investing).

Generates a sentiment score between -1 and 1 with 2 decimal precision.

Returns JSON (ticker, score, explanation, timestamp).

Plug-and-play API endpoint:

/api/sentiment/:ticker

Setup Instructions
1. Clone the Git
 git clone https://github.com/<your-username>/sentirion.git

2. Navigate to Backend
cd backend

3. Install Dependencies
npm install

4. Add .env file to backend

Place the .env file inside backend/

4. Start the Backend
npm start

You should see:

Backend running on port 3001

Usage

Call the API from your browser or trading code in a terminal:

curl http://localhost:3001/api/sentiment/AAPL    
(can paste in any ticker)


Example Response:

{
  "ticker": "AAPL",
  "score": 0.62,
  "explanation": "Positive posts about iPhone demand with minor macro concerns.",
  "timestamp": "2025-10-01T02:45:12.345Z"
}


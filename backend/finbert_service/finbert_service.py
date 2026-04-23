print("FILE IS EXECUTING")

import os
from flask import Flask, request, jsonify
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch

app = Flask(__name__)

# Choose device
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Running on: {device}")

# MODEL NAME (this is the correct one)
MODEL_NAME = "yiyanghkust/finbert-tone"

# Load tokenizer and model with HF token
tokenizer = AutoTokenizer.from_pretrained(
    MODEL_NAME,
    use_auth_token=os.environ.get("HF_TOKEN")
)

model = AutoModelForSequenceClassification.from_pretrained(
    MODEL_NAME,
    use_auth_token=os.environ.get("HF_TOKEN")
).to(device)
model.eval()

# FinBERT-Tone label mapping from model.config.id2label
# Should be: {0: "neutral", 1: "positive", 2: "negative"}
id2label = model.config.id2label


@app.route("/finbert", methods=["POST"])
def finbert_sentiment():
    data = request.json
    texts = data.get("texts", [])

    if not texts:
        return jsonify({"error": "No texts provided"}), 400

    results = []

    for text in texts:
        encoded = tokenizer(
            text,
            return_tensors="pt",
            truncation=True,
            padding=True,
            max_length=256
        ).to(device)

        with torch.no_grad():
            logits = model(**encoded).logits
            probs = torch.softmax(logits, dim=1)[0].cpu().numpy()

        neutral, positive, negative = probs

        # sentiment score: positive - negative
        score = float(positive - negative)

        # classify by thresholds
        if score > 0.25:
            label = "positive"
        elif score < -0.25:
            label = "negative"
        else:
            label = "neutral"

        results.append({
            "text": text,
            "score": score,
            "label": label,
            "raw_probabilities": {
                "neutral": float(neutral),
                "positive": float(positive),
                "negative": float(negative)
            }
        })

    return jsonify(results)


if __name__ == "__main__":
    print("SERVER STARTING...")
    app.run(host="127.0.0.1", port=5001)

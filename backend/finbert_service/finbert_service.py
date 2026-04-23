print("FILE IS EXECUTING")

from flask import Flask, request, jsonify
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch

app = Flask(__name__)

tokenizer = AutoTokenizer.from_pretrained("ProsusAI/finbert")
model = AutoModelForSequenceClassification.from_pretrained("ProsusAI/finbert")
labels = {int(index): str(label).lower() for index, label in model.config.id2label.items()}
positive_index = next(index for index, label in labels.items() if label == "positive")
negative_index = next(index for index, label in labels.items() if label == "negative")

@app.route("/finbert", methods=["POST"])
def finbert_sentiment():
    data = request.json
    texts = data["texts"]

    scores = []

    for text in texts:
        inputs = tokenizer(
            text,
            return_tensors="pt",
            truncation=True,
            padding=True,
            max_length=256,
        )

        with torch.no_grad():
            outputs = model(**inputs)
            probs = torch.softmax(outputs.logits, dim=1)[0].numpy()

        positive = probs[positive_index]
        negative = probs[negative_index]

        # Sentiment score: +1 positive, -1 negative
        weighted_score = float(positive - negative)
        scores.append(weighted_score)

    avg_score = sum(scores) / len(scores)

    if avg_score > 0.25:
        label = "positive"
    elif avg_score < -0.25:
        label = "negative"
    else:
        label = "neutral"

    return jsonify({
        "score": avg_score,
        "label": label
    })

if __name__ == "__main__":
    print("SERVER STARTING...")
    app.run(host="127.0.0.1", port=5001)

import os
from flask import Flask, request, jsonify, render_template
import traceback
from openai import OpenAI

app = Flask(__name__)

# ⚠️ Set NVIDIA_API_KEY environment variable before running
# export NVIDIA_API_KEY="nvapi-..."
API_KEY = os.environ.get("NVIDIA_API_KEY", "")
MODEL = os.environ.get("NVIDIA_MODEL", "meta/llama-3.1-8b-instruct")

if not API_KEY:
    print("WARNING: NVIDIA_API_KEY not set. Set it as an environment variable.")

client = OpenAI(
    base_url="https://integrate.api.nvidia.com/v1",
    api_key=API_KEY
)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/chat', methods=['POST'])
def chat():
    try:
        data = request.get_json()
        message = data.get("message", "").strip()

        if not message:
            return jsonify({"error": "No message"}), 400

        # Using non-streaming for now (more stable for debugging)
        response = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": message}],
            temperature=0.7,
            max_tokens=800
        )

        reply = response.choices[0].message.content
        return jsonify({"response": reply})

    except Exception as e:
        print("=== FULL ERROR ===")
        traceback.print_exc()           # This will show the real error
        print("==================")
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)

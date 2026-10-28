"""Local HTTP relay: searches Wikipedia, asks Ollama, and returns citations."""
import os
import secrets

import requests
from flask import Flask, jsonify, request

app = Flask(__name__)
RELAY_SECRET = os.environ.get("RELAY_SECRET", "")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434")
MODEL = os.getenv("OLLAMA_MODEL", "gemma4:e2b")


def search_sources(question: str) -> list[dict]:
    """Search Wikipedia's public API and return pages that can be cited."""
    response = requests.get(
        "https://zh.wikipedia.org/w/api.php",
        params={"action": "query", "list": "search", "srsearch": question,
                "format": "json", "utf8": 1, "srlimit": 5},
        headers={"User-Agent": "W7LocalModelRelay/1.0 (educational demo)"},
        timeout=20,
    )
    response.raise_for_status()
    results = response.json().get("query", {}).get("search", [])
    return [{
        "title": item["title"],
        "url": "https://zh.wikipedia.org/wiki/" + requests.utils.quote(item["title"].replace(" ", "_")),
        "snippet": item.get("snippet", "").replace("<span class=\"searchmatch\">", "").replace("</span>", ""),
    } for item in results]


def make_search_query(question: str) -> str:
    """Use the local model only to turn a full question into search terms."""
    response = requests.post(
        OLLAMA_URL.rstrip("/") + "/api/chat",
        json={
            "model": MODEL,
            "stream": False,
            "options": {"temperature": 0},
            "messages": [
                {"role": "system", "content": "把問題改寫成適合維基百科搜尋的繁體中文短詞組，只輸出搜尋詞，不回答問題。"},
                {"role": "user", "content": question},
            ],
        },
        timeout=120,
    )
    response.raise_for_status()
    query = response.json().get("message", {}).get("content", "").strip().strip('「」\"')
    return query[:200] or question


@app.post("/ask")
def ask():
    supplied = request.headers.get("X-Relay-Secret", "")
    if not RELAY_SECRET:
        return jsonify(error="relay secret is not configured"), 503
    if not secrets.compare_digest(supplied, RELAY_SECRET):
        return jsonify(error="unauthorized"), 401
    body = request.get_json(silent=True) or {}
    question = str(body.get("question", "")).strip()
    if not question or len(question) > 1000:
        return jsonify(error="question must be 1–1000 characters"), 400
    # Visible in the relay terminal so the class can observe the handoff.
    print(f"收到查詢：{question}", flush=True)
    try:
        search_query = make_search_query(question)
        sources = search_sources(search_query)
        if not sources:
            return jsonify(answer="找不到可用來源，暫時無法可靠回答。", sources=[])
        source_context = "\n\n".join(
            f"[{i}] {s['title']}\nURL: {s['url']}\n摘要: {s['snippet']}"
            for i, s in enumerate(sources, 1)
        )
        result = requests.post(
            OLLAMA_URL.rstrip("/") + "/api/chat",
            json={
                "model": MODEL,
                "stream": False,
                "messages": [
                    {"role": "system", "content": (
                        "你是繁體中文助理。只根據提供的搜尋結果回答；若證據不足，明說不知道。"
                        "在相關句子後以 [1] 這種格式標示來源編號。不可捏造來源或事實。"
                    )},
                    {"role": "user", "content": f"問題：{question}\n\n搜尋結果：\n{source_context}"},
                ],
            },
            timeout=120,
        )
        result.raise_for_status()
        answer = result.json().get("message", {}).get("content", "").strip()
        return jsonify(answer=answer or "模型沒有產生回答。", sources=sources)
    except requests.RequestException:
        app.logger.exception("Upstream service failed")
        return jsonify(error="search or local model service unavailable"), 502


if __name__ == "__main__":
    # Bind only to loopback. Publish via an HTTPS tunnel with access controls.
    if not RELAY_SECRET:
        raise SystemExit("請先設定環境變數 RELAY_SECRET")
    app.run(host="127.0.0.1", port=int(os.getenv("PORT", "8787")))

import requests
import urllib.parse
from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
import logging
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from transformers import pipeline
import re
import time
import threading
import email.utils

# Additional imports for updated credibility scoring
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from urllib.parse import urlparse
import nltk
from nltk.tokenize import word_tokenize
from nltk.corpus import stopwords
from nltk.stem import PorterStemmer

nltk.download('punkt')
nltk.download('stopwords')

# Load stopwords once globally
stop_words = set(stopwords.words('english'))
stemmer = PorterStemmer()

# Logging
logging.basicConfig(level=logging.INFO)

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# MongoDB Setup
client = MongoClient('mongodb://localhost:27017/')
db = client['news_db']
favorite_collection = db['favorite_topics']

# API keys
GNEWS_API_KEY = '44d4d489fa6f355ed8fea57b8d270db6'
NEWSAPI_KEY = 'cb31a32329724d17a93a862062306786'

# Summarization pipeline using T5-base
summarizer = pipeline("summarization", model="t5-base", tokenizer="t5-base")

def is_valid_link(link):
    parsed_link = urlparse(link)
    return parsed_link.scheme in ["http", "https"] and parsed_link.netloc

def is_clickbait(title):
    clickbait_patterns = [
        r"you won't believe", r"shocking", r"amazing", r"what happened next",
        r"top \d+", r"this is why", r"can't miss", r"secret", r"revealed",
        r"hack", r"boost", r"insane", r"crazy", r"trick", r"epic"
    ]
    title_lower = title.lower()
    for pattern in clickbait_patterns:
        if re.search(pattern, title_lower):
            return True
    return False

def days_since(date_str):
    try:
        # Parse RSS pubDate string to timestamp with timezone
        timestamp = email.utils.mktime_tz(email.utils.parsedate_tz(date_str))
        published_date = datetime.fromtimestamp(timestamp, timezone.utc)
        delta = datetime.now(timezone.utc) - published_date
        return delta.days
    except Exception:
        return 30  # fallback large number if parsing fails

def compute_credibility(title, summary, rss_articles):
    texts = [title + " " + (summary or "")]
    rss_texts = [a['title'] + " " + (a.get('summary') or "") for a in rss_articles]

    corpus = texts + rss_texts

    vectorizer = TfidfVectorizer(stop_words='english', max_features=500)
    tfidf_matrix = vectorizer.fit_transform(corpus)

    article_vec = tfidf_matrix[0]
    rss_vecs = tfidf_matrix[1:]

    if rss_vecs.shape[0] == 0:
        return {"score": 0, "matched_links": []}

    sims = cosine_similarity(article_vec, rss_vecs)[0]

    threshold = 0.3
    matched_indices = [i for i, sim in enumerate(sims) if sim >= threshold]

    if not matched_indices:
        return {"score": 0, "matched_links": []}

    matched_links = []
    matched_domains = set()
    recency_score = 0

    for i in matched_indices:
        rss_article = rss_articles[i]
        link = rss_article.get('link')
        if link and is_valid_link(link):
            matched_links.append(link)
            domain = urlparse(link).netloc
            matched_domains.add(domain)

            days_old = days_since(rss_article.get('publishedAt') or '')
            if days_old <= 2:
                recency_score += 0.5
            elif days_old <= 7:
                recency_score += 0.2

    base_score = len(matched_indices)
    diversity_score = min(1.5, 0.3 * len(matched_domains))
    penalty = -1 if is_clickbait(title) else 0

    final_score = max(0, base_score + diversity_score + recency_score + penalty)

    return {
        "score": round(final_score, 2),
        "matched_links": matched_links
    }

def get_rss_articles(topic=""):
    rss_articles = []
    encoded_topic = urllib.parse.quote(topic)
    google_news_url = f'https://news.google.com/rss/search?q={encoded_topic}&hl=en-IN&gl=IN&ceid=IN:en'
    try:
        response = requests.get(google_news_url)
        response.raise_for_status()
        root = ET.fromstring(response.content)
        for entry in root.findall('.//item'):
            title = entry.find('title').text if entry.find('title') is not None else ""
            link = entry.find('link').text if entry.find('link') is not None else ""
            summary = entry.find('description').text if entry.find('description') is not None else ""
            content = entry.find('content').text if entry.find('content') is not None else ""
            pub_date = entry.find('pubDate').text if entry.find('pubDate') is not None else ""
            if link and is_valid_link(link):
                rss_articles.append({
                    "title": title,
                    "link": link,
                    "summary": summary,
                    "content": content,
                    "publishedAt": pub_date
                })
    except requests.exceptions.RequestException as e:
        logging.error(f"Error fetching RSS feed: {e}")
    return rss_articles

def fetch_from_newsapi(topic, limit):
    from_date = (datetime.now(timezone.utc) - timedelta(days=2)).strftime('%Y-%m-%d')
    url = (
        f"https://newsapi.org/v2/everything?"
        f"q={topic}&from={from_date}&sortBy=publishedAt&"
        f"language=en&pageSize={limit}&apiKey={NEWSAPI_KEY}"
    )
    try:
        res = requests.get(url, timeout=5)
        if res.status_code == 200:
            articles = res.json().get('articles', [])
            return [
                {
                    "title": a.get('title'),
                    "description": a.get('description'),
                    "content": a.get('content', ''),
                    "url": a.get('url'),
                    "image": a.get('urlToImage'),
                    "publisher": a.get('source', {}).get('name', 'Unknown'),
                    "publishedAt": a.get('publishedAt')
                }
                for a in articles if a.get('urlToImage') and a.get('urlToImage').startswith('http')
            ]
        else:
            logging.error(f"NewsAPI returned non-200 status: {res.status_code}, Response: {res.text}")
    except requests.exceptions.Timeout:
        logging.error("NewsAPI request timed out.")
    except requests.exceptions.RequestException as e:
        logging.error(f"NewsAPI request failed: {e}")
    return []

def fetch_from_gnews(topic, limit):
    url = (
        f"https://gnews.io/api/v4/search?"
        f"q={topic}&token={GNEWS_API_KEY}&lang=en&country=in&max={limit}&sortby=publishedAt"
    )
    try:
        res = requests.get(url)
        if res.status_code == 200:
            articles = res.json().get('articles', [])
            return [
                {
                    "title": a.get('title'),
                    "description": a.get('description'),
                    "content": a.get('content', ''),
                    "url": a.get('url'),
                    "image": a.get('image'),
                    "publisher": a.get('source', {}).get('name', 'Unknown'),
                    "publishedAt": a.get('publishedAt')
                }
                for a in articles if a.get('image') and a.get('image').startswith('http')
            ]
    except Exception as e:
        logging.error(f"GNews error: {e}")
    return []

def clean_text(text):
    text = re.sub(r'\[\d+\s*chars\]', '', text)
    text = text.replace("Read more", "").replace("Hide Summary", "")
    return text.strip()

def extract_and_summarize(content):
    content = clean_text(content)
    content = ' '.join(content.split())

    if len(content) < 100:
        return {"summary": content}

    max_words = 512
    words = content.split()
    if len(words) > max_words:
        content = ' '.join(words[:max_words])

    input_text = "summarize: " + content

    summary = summarizer(
        input_text,
        max_length=130,
        min_length=80,
        do_sample=False,
        early_stopping=True
    )
    return {"summary": summary[0]['summary_text'].strip()}

def fetch_and_store_fav_articles():
    categories = ['business', 'technology', 'sports', 'science']
    for category in categories:
        articles = fetch_from_newsapi(category, 15)
        for a in articles:
            rss_articles = get_rss_articles(a['title'])
            credibility = compute_credibility(a['title'], a['description'], rss_articles)
            a['credibility'] = credibility
        favorite_collection.update_one(
            {"category": category},
            {"$set": {"articles": articles}},
            upsert=True
        )

def schedule_favorite_topic_refresh():
    while True:
        fetch_and_store_fav_articles()
        time.sleep(1800)  # Refresh every 30 minutes

def initial_fetch():
    logging.info("Starting initial fetch of favorite topic articles...")
    fetch_and_store_fav_articles()

@app.route('/api/news', methods=['GET'])
def get_news():
    topic = request.args.get('topic', 'trending').lower()
    limit = int(request.args.get('limit', 20))
    topic_query = "India" if topic == "trending" else (topic if "india" in topic else f"{topic} India")
    articles = fetch_from_gnews(topic_query, limit)
    for a in articles:
        rss_articles = get_rss_articles(a['title'])
        credibility = compute_credibility(a['title'], a['description'], rss_articles)
        a['credibility'] = credibility
    return jsonify(articles)

@app.route('/api/favorite-topics', methods=['GET'])
def get_favorite_topics():
    category = request.args.get('category', '').lower()
    limit = int(request.args.get('limit', 10))
    if not category:
        return jsonify({"message": "Category is required."}), 400
    fav_topic = favorite_collection.find_one({"category": category})
    if fav_topic:
        articles = fav_topic.get('articles', [])[:limit]
        return jsonify(articles)
    else:
        return jsonify({"message": f"No articles found for {category}."}), 404

@app.route('/api/summarize', methods=['POST'])
def summarize_article():
    content = request.json.get('content')
    if not content:
        return jsonify({"summary": ""})
    result = extract_and_summarize(content)
    return jsonify(result)

if __name__ == '__main__':
    logging.info("Starting background threads...")
    threading.Thread(target=initial_fetch, daemon=True).start()
    threading.Thread(target=schedule_favorite_topic_refresh, daemon=True).start()
    app.run(debug=True, host='0.0.0.0')

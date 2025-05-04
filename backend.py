import os
import requests
from pymongo import MongoClient
from datetime import datetime, timedelta
import threading
import time

# ✅ GNews API Key
API_KEY = "44d4d489fa6f355ed8fea57b8d270db6"
GNEWS_URL = "https://gnews.io/api/v4/top-headlines"

# ✅ Categories to fetch
CATEGORIES = ["business", "entertainment", "sports", "science", "technology"]

# ✅ MongoDB connection
client = MongoClient("mongodb://localhost:27017/")
db = client["news_db"]
collection = db["articles"]

# ✅ Delete articles older than 1 day
def delete_old_articles():
    one_day_ago = datetime.utcnow() - timedelta(days=1)
    result = collection.delete_many({"publication_date": {"$lt": one_day_ago}})
    print(f"🗑️ Deleted {result.deleted_count} old articles")

# ✅ Fetch articles for each category
def fetch_articles():
    print("🔄 Fetching latest articles...")
    delete_old_articles()

    for category in CATEGORIES:
        print(f"🌐 Fetching category: {category}")

        params = {
            "token": API_KEY,
            "lang": "en",
            "topic": category,
            "max": 10
        }

        try:
            response = requests.get(GNEWS_URL, params=params)
            if response.status_code != 200:
                print(f"❌ Error fetching {category}: {response.status_code}")
                continue

            data = response.json()
            articles = data.get("articles", [])
            print(f"📦 Found {len(articles)} articles for {category}")

            for article in articles:
                if not article.get("image"):
                    print(f"⚠️ Skipping no-image: {article['title']}")
                    continue

                title = article["title"]
                if collection.count_documents({"title": title}) > 0:
                    print(f"⏩ Duplicate: {title}")
                    continue

                published_at = article.get("publishedAt")
                if published_at:
                    try:
                        published_at = datetime.strptime(published_at, "%Y-%m-%dT%H:%M:%SZ")
                    except:
                        published_at = datetime.utcnow()
                else:
                    published_at = datetime.utcnow()

                doc = {
                    "title": title,
                    "full_link": article["url"],
                    "category": category,
                    "publication_date": published_at,
                    "source": article["source"]["name"] if "source" in article else "GNews",
                    "image": article["image"],
                    "full_text": article.get("description", ""),
                    "summary": "",
                    "summary_generated": False,
                }

                collection.insert_one(doc)
                print(f"✅ Inserted: {title}")

            # ✅ Limit to latest 10 per category
            existing = list(collection.find({"category": category}).sort("publication_date", -1))
            if len(existing) > 10:
                to_delete = existing[10:]
                ids_to_delete = [doc["_id"] for doc in to_delete]
                deleted = collection.delete_many({"_id": {"$in": ids_to_delete}})
                print(f"🧹 Removed {deleted.deleted_count} old {category} articles")

        except Exception as e:
            print(f"⚠️ Exception fetching {category}: {e}")

# ✅ Fetch new articles for frontend
def fetch_new_articles_for_frontend():
    return list(collection.find().sort("publication_date", -1))

# ✅ Background thread to fetch every 30 minutes
def background_fetch():
    while True:
        fetch_articles()
        time.sleep(1800)

# ✅ Start background fetcher
def start_background_fetcher():
    fetch_thread = threading.Thread(target=background_fetch, daemon=True)
    fetch_thread.start()

# ✅ Run on start
if __name__ == "__main__":
    fetch_articles()
    start_background_fetcher()

    print("📰 Sample articles:")
    for article in fetch_new_articles_for_frontend()[:5]:
        print(f"{article['title']} - {article['publication_date']}")

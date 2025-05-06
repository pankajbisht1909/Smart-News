import streamlit as st
from pymongo import MongoClient
from transformers import pipeline
import requests
import textwrap
import base64
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
import re
import nltk
from nltk.data import find

def safe_nltk_download(package_name):
    try:
        # Check location based on package type
        if package_name == 'punkt':
            find('tokenizers/punkt')
        elif package_name == 'stopwords':
            find('corpora/stopwords')
    except LookupError:
        nltk.download(package_name, quiet=True)

# Ensure required NLTK data is available
safe_nltk_download('punkt')
safe_nltk_download('stopwords')


# MongoDB Connection
client = MongoClient("mongodb://localhost:27017/")
db = client["news_db"]
collection = db["articles"]

# Load pre-trained summarization model
summarizer = pipeline("summarization", model="facebook/bart-large-cnn", device=-1)

# API keys
MAIN_API_KEY = "44d4d489fa6f355ed8fea57b8d270db6"
BACKUP_API_KEY = "cb31a32329724d17a93a862062306786"

# Background image
def get_base64_of_image(image_path):
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode()

# Function to extract keywords (nouns/important words) from a text
def extract_keywords(text):
    stop_words = set(stopwords.words('english'))
    word_tokens = word_tokenize(text)
    keywords = [word.lower() for word in word_tokens if word.isalnum() and word.lower() not in stop_words]
    return set(keywords)

# Fetch news from RSS (example using Google News RSS)
def fetch_rss_feed(topic, quantity=5):
    rss_url = f'https://news.google.com/rss/search?q={topic}&hl=en-IN&gl=IN&ceid=IN:en'
    response = requests.get(rss_url)
    if response.status_code == 200:
        return response.text
    else:
        st.warning("Failed to fetch RSS feed.")
        return ""

# Check if article matches any RSS feed articles by matching keywords
def check_match_in_rss(article_title, article_content):
    rss_feed = fetch_rss_feed(article_title)
    if not rss_feed:
        return None
    
    # Parse the RSS feed (simplified for example)
    matched_articles = []
    rss_articles = re.findall(r'<item>.*?<title>(.*?)</title>.*?<link>(.*?)</link>.*?<description>(.*?)</description>.*?</item>', rss_feed, re.DOTALL)

    # Extract keywords from the article's title and content
    article_keywords = extract_keywords(article_title + " " + article_content)

    for title, link, description in rss_articles:
        # Extract keywords from RSS description
        rss_keywords = extract_keywords(title + " " + description)
        
        # Check for overlap in keywords
        if article_keywords & rss_keywords:  # If there's an intersection of keywords
            matched_articles.append({
                "url": link,
                "credibility_score": 85  # Placeholder score; implement a more advanced scoring if needed
            })

    return matched_articles

# News fetching with backup
def fetch_news_from_online_source(topic, news_quantity=5):
    st.info("Fetching news online...")
    primary_url = f'https://newsapi.org/v2/everything?q={topic}&sortBy=publishedAt&language=en&pageSize=30&apiKey={BACKUP_API_KEY}'
    articles = []

    # Try fetching from main API
    try:
        response = requests.get(primary_url)
        if response.status_code == 200:
            primary_articles = response.json().get('articles', [])
            filtered_primary = [a for a in primary_articles if topic.lower() in a['title'].lower()]
            articles.extend(filtered_primary[:news_quantity])  # Limit articles from primary API to requested quantity
            print(f"Fetched {len(filtered_primary)} articles from main API.")
        else:
            st.warning(f"Main API failed (status {response.status_code})")
    except requests.exceptions.RequestException as e:
        st.error(f"GNews API error: {e}")

    # If not enough articles from primary, fetch remainder from backup
    if len(articles) < news_quantity:
        st.info(f"Fetching {news_quantity - len(articles)} more from backup API...")
        backup_articles = fetch_from_backup_api(topic, news_quantity - len(articles))  # Fetch only the remaining articles
        for ba in backup_articles:
            if len(articles) >= news_quantity:
                break
            # Avoid duplicates by title
            if not any(ba['title'] == a['title'] for a in articles):
                articles.append(ba)

    print(f"Total articles fetched: {len(articles)}")  # Debug statement to check final count
    # Ensure that the total number of articles doesn't exceed the requested quantity
    return articles[:news_quantity]

def fetch_from_backup_api(topic, news_quantity):
    backup_url = f'https://gnews.io/api/v4/search?q={topic}&max=30&lang=in&token={MAIN_API_KEY}'
    try:
        response = requests.get(backup_url)
        if response.status_code == 200:
            articles = response.json().get('articles', [])
            return [a for a in articles if topic.lower() in a['title'].lower()]
        else:
            st.error(f"Backup API failed (status {response.status_code})")
            return []
    except requests.exceptions.RequestException as e:
        st.error(f"Backup API error: {e}")
        return []

# Summarization helpers
def chunk_text(text, chunk_size=1024):
    return textwrap.wrap(text, chunk_size)

def generate_summary(content, max_words=200):
    if content:
        tokens_per_word = 1.33
        max_tokens = min(int(max_words * tokens_per_word), 1024)
        chunks = chunk_text(content, max_tokens)
        summaries = [summarizer(chunk, max_length=max_tokens, min_length=50, do_sample=False)[0]['summary_text'] for chunk in chunks]
        return " ".join(summaries)
    return "No content available for summary."

# Display functions with RSS matching logic
# Display functions with RSS matching logic
def display_news_from_db(query, news_quantity):
    articles = collection.find(query).limit(news_quantity)
    count = 0
    for article in articles:
        count += 1
        st.write(f"**({count}) {article['title']}**")
        st.markdown(f"**Source:** {article['source']}")
        st.markdown(f"[Read More]({article['full_link']})")
        st.success(f"Published on: {article['publication_date']}")
        st.image(article.get("image", "https://via.placeholder.com/600x400?text=No+Image"), width=700)
        
        # Check for matches in RSS and display credibility immediately
        matches = check_match_in_rss(article['title'], article['full_text'])
        if matches:
            st.markdown("### Matched Articles in RSS Feed:")
            for match in matches:
                st.markdown(f"[Click to view original article]({match['url']})")
                st.markdown(f"**Credibility Score:** {match['credibility_score']}")
        
        # Show the summary after clicking the button
        if article.get("full_text") and st.button(f"Create Summary for: {article['title']}", key=f"summary_btn_{article['_id']}"):
            summary = generate_summary(article['full_text'])
            with st.expander(f"Summary for: {article['title']}"):
                st.write(summary)

def display_news_from_online(news_data, news_quantity):
    for count, article in enumerate(news_data[:news_quantity], 1):
        title = article.get("title") or "No Title"
        content = article.get("content") or article.get("description") or ""
        source = article.get("source", {}).get("name") if isinstance(article.get("source"), dict) else article.get("source", "Unknown")
        url = article.get("url") or article.get("full_link", "#")
        image = article.get("image") or article.get("urlToImage") or "https://via.placeholder.com/600x400?text=No+Image"
        published = article.get("publishedAt") or article.get("publication_date", "Unknown")

        st.write(f"**({count}) {title}**")
        st.markdown(f"**Source:** {source}")
        st.markdown(f"[Read More]({url})")
        st.success(f"Published on: {published}")
        st.image(image, width=700)

        # RSS Match and Credibility
        matches = check_match_in_rss(title, content)
        if matches:
            avg_score = round(sum(m['credibility_score'] for m in matches) / len(matches), 2)
            st.markdown(f"**🧠 Avg Credibility Score from RSS Matches:** `{avg_score}`")
        else:
            st.info("No matched RSS articles found.")

        # Always-visible Summary Expander
        if content:
            with st.expander(f"📝 Summary for: {title}"):
                summary = generate_summary(content)
                st.write(summary)

        # Always-visible RSS Expander
        if matches:
            with st.expander("📂 Matched in RSS (click to view sources)"):
                for match in matches:
                    source_data = match.get("source")
                    rss_source = source_data.get("name") if isinstance(source_data, dict) else str(source_data) or "Unknown Source"
                    rss_url = match.get("url", "#")
                    st.markdown(f"- **{rss_source}**: [View Article]({rss_url})")



# Main App
def run():
    image_base64 = get_base64_of_image("C:/smart/pexels-pixabay-158651.jpg")
    st.markdown(
        f"""
        <style>
        .stApp {{
            background-image: url("data:image/jpg;base64,{image_base64}");
            background-size: cover;
            background-attachment: fixed;
            background-repeat: no-repeat;
        }}
        </style>
        """,
        unsafe_allow_html=True
    )

    st.title("Smart News: 📰")
    st.subheader("Your one-stop destination for the latest news!")

    category_option = st.selectbox('Select your Category', ['--Select--', 'Trending🔥 News', 'Favourite💙 Topics', 'Search🔍 Topic'])

    if category_option == '--Select--':
        st.warning("Please choose a category to proceed!")

    elif category_option == 'Trending🔥 News':
        st.subheader("Trending News 🔥")
        count = st.slider('Number of Articles:', 5, 25, 5)
        
        if 'trending_news' not in st.session_state or st.session_state.prev_trending_slider != count:
            trending_data = fetch_news_from_online_source("India", count)
            st.session_state.trending_news = trending_data
            st.session_state.prev_trending_slider = count
        display_news_from_online(st.session_state.trending_news, count)

    elif category_option == 'Favourite💙 Topics':
        topics = ['Choose Topic', 'Business', 'Entertainment', 'Science', 'Sports', 'Technology']
        selected = st.selectbox("Choose your favourite Topic", topics)
        count = st.slider('Number of Articles:', 5, 10, 5)

        if selected == 'Choose Topic':
            st.warning("Please select a topic!")
        else:
            session_key = f"fav_news_{selected.lower()}"
            if session_key not in st.session_state:
                st.session_state[session_key] = fetch_news_from_online_source(selected, count)
            display_news_from_online(st.session_state[session_key], count)  
    elif category_option == 'Search🔍 Topic':
        st.subheader("Search News 🔍")
        search_input = st.text_input("Enter your topic (e.g., elections, space, economy):")
        count = st.slider('Number of Articles:', 5, 15, 5)

        if search_input:
            # Fetch news from online sources (GNews or NewsAPI)
            st.info("Fetching news online...")
            online_data = fetch_news_from_online_source(search_input, count)

            if online_data:
                display_news_from_online(online_data, count)
            else:
                st.warning("No articles found for your search. Please try a different topic.")


if __name__ == "__main__":
    run()


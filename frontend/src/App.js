import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const NewsCategorySelector = () => {
  const [categories] = useState(['Trending', 'Search by Topic', 'Favorite Topic']);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [customTopic, setCustomTopic] = useState('');
  const [favoriteTopicCategory, setFavoriteTopicCategory] = useState('');
  const [allNews, setAllNews] = useState([]);
  const [newsToShow, setNewsToShow] = useState([]);
  const [loading, setLoading] = useState(false);
  const [summaries, setSummaries] = useState({});
  const [summaryLoading, setSummaryLoading] = useState({});
  const [showSummary, setShowSummary] = useState({});
  const [articleLimit, setArticleLimit] = useState(5);
  const [lastFetchedLimit, setLastFetchedLimit] = useState(0);
  const [hasFetched, setHasFetched] = useState(false);
  const [expandedLinkIndex, setExpandedLinkIndex] = useState(null);
  const [savedArticles, setSavedArticles] = useState({});

  const fetchNews = async (topic, limit, isTrending = false, isFavorite = false, favoriteCategory = '') => {
    setLoading(true);
    try {
      let endpoint = '';
      if (isTrending) {
        endpoint = `http://localhost:5000/api/news?topic=trending&limit=${limit}`;
      } else if (isFavorite && favoriteCategory) {
        endpoint = `http://localhost:5000/api/favorite-topics?category=${favoriteCategory}&limit=${limit}`;
      } else {
        endpoint = `http://localhost:5000/api/news?topic=${encodeURIComponent(topic)}&limit=${limit}`;
      }

      const response = await axios.get(endpoint);
      const filtered = response.data.filter(article => article.image);
      setAllNews(filtered);
      setLastFetchedLimit(limit);
      setNewsToShow(filtered.slice(0, limit));
      setHasFetched(true);
    } catch (error) {
      console.error("Error fetching news:", error);
      alert("Error fetching news.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCategory === 'Trending') {
      fetchNews('', articleLimit, true);
    }
  }, [selectedCategory, articleLimit]);

  useEffect(() => {
    if (!selectedCategory) return;
    if (articleLimit <= lastFetchedLimit) {
      setNewsToShow(allNews.slice(0, articleLimit));
    } else {
      if (selectedCategory === 'Trending') {
        fetchNews('', articleLimit, true);
      } else if (selectedCategory === 'Search by Topic' && customTopic.trim()) {
        fetchNews(customTopic.trim(), articleLimit);
      } else if (selectedCategory === 'Favorite Topic' && favoriteTopicCategory) {
        fetchNews('', articleLimit, false, true, favoriteTopicCategory);
      }
    }
  }, [articleLimit, allNews, customTopic, favoriteTopicCategory, lastFetchedLimit, selectedCategory]);

  useEffect(() => {
    if (selectedCategory === 'Favorite Topic' && favoriteTopicCategory) {
      fetchNews('', articleLimit, false, true, favoriteTopicCategory);
    }
  }, [favoriteTopicCategory, selectedCategory, articleLimit]);

  const handleCategoryChange = (e) => {
    const category = e.target.value;
    setSelectedCategory(category);
    setCustomTopic('');
    setSummaries({});
    setAllNews([]);
    setNewsToShow([]);
    setLastFetchedLimit(0);
    setShowSummary({});
    setSavedArticles({});
    setHasFetched(false);
    if (category !== 'Favorite Topic') {
      setFavoriteTopicCategory('');
    }
  };

  const handleCustomTopicSubmit = () => {
    if (customTopic.trim()) {
      fetchNews(customTopic.trim(), articleLimit);
    }
  };

  const handleFavoriteTopicCategoryChange = (e) => {
    setFavoriteTopicCategory(e.target.value);
  };

  const handleCreateSummary = async (article, index) => {
    if (!article.content || summaries[index]) {
      setShowSummary(prev => ({ ...prev, [index]: !prev[index] }));
      return;
    }

    setSummaryLoading(prev => ({ ...prev, [index]: true }));
    try {
      const response = await axios.post('http://localhost:5000/api/summarize', {
        content: article.content,
      });
      setSummaries(prev => ({ ...prev, [index]: response.data.summary }));
      setShowSummary(prev => ({ ...prev, [index]: true }));
    } catch (error) {
      console.error("Summarization failed:", error);
    } finally {
      setSummaryLoading(prev => ({ ...prev, [index]: false }));
    }
  };

  const handleToggleExpandedLinks = (index) => {
    setExpandedLinkIndex(expandedLinkIndex === index ? null : index);
  };

  const handleSaveArticle = async (article, index) => {
    try {
      await axios.post('http://localhost:5000/api/save-article', {
        title: article.title,
        url: article.url,
        image: article.image,
        publisher: article.publisher || article.source?.name,
        description: article.description,
        credibility: article.credibility,
      });
      setSavedArticles(prev => ({ ...prev, [index]: true }));
    } catch (error) {
      console.error("Failed to save article:", error);
      alert("Could not save article.");
    }
  };

  return (
    <div className="news-container">
      <div className="news-inner">
        <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>Select a News Category</h2>
        <select className="news-select" onChange={handleCategoryChange} value={selectedCategory}>
          <option value="" disabled>Select</option>
          {categories.map(category => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>

        {selectedCategory === 'Favorite Topic' && (
          <div className="topic-input-container" style={{ marginBottom: '15px' }}>
            <label style={{ marginRight: '10px', fontWeight: 'bold' }}>Select Category:</label>
            <select onChange={handleFavoriteTopicCategoryChange} value={favoriteTopicCategory} className="news-select" style={{ maxWidth: '300px' }}>
              <option value="" disabled>Select Category</option>
              <option value="business">Business</option>
              <option value="technology">Technology</option>
              <option value="sports">Sports</option>
              <option value="science">Science</option>
            </select>
          </div>
        )}

        {selectedCategory === 'Search by Topic' && (
          <div className="topic-input-container" style={{ marginBottom: '15px' }}>
            <input
              type="text"
              placeholder="Enter topic"
              value={customTopic}
              onChange={(e) => setCustomTopic(e.target.value)}
              className="topic-input"
            />
            <button className="button" onClick={handleCustomTopicSubmit}>Fetch News</button>
          </div>
        )}

        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontWeight: 'bold' }}>Articles to Show: {articleLimit}</label>
          <input
            type="range"
            min="5"
            max={selectedCategory === 'Favorite Topic' ? '15' : '25'}
            step="5"
            value={articleLimit}
            onChange={(e) => setArticleLimit(Number(e.target.value))}
            style={{ width: '100%', marginTop: '5px' }}
          />
        </div>

        <div>
          {loading ? <p>Loading...</p> : (
            hasFetched ? (
              newsToShow.length > 0 ? newsToShow.map((article, index) => (
                <div key={index} className="article-card">
                  <h3>{article.title}</h3>
                  <p><strong>Publisher:</strong> {article.publisher || article.source?.name || 'Unknown'}</p>
                  <p><strong>Credibility Score:</strong> {article.credibility?.score ?? 'N/A'}</p>

                  {article.credibility?.matched_links?.length > 1 && (
                    <div style={{ marginBottom: '10px' }}>
                      <strong>Matched RSS Links:</strong>
                      <button className="button" onClick={() => handleToggleExpandedLinks(index)} style={{ marginLeft: '10px' }}>
                        {expandedLinkIndex === index ? 'Hide Links' : 'Show Links'}
                      </button>
                      {expandedLinkIndex === index && (
                        <ul style={{ marginTop: '10px' }}>
                          {article.credibility.matched_links.filter(link => link !== article.url).map((link, i) => (
                            <li key={i}>
                              <a href={link} target="_blank" rel="noopener noreferrer">{link}</a>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  <img className="article-image" src={article.image} alt="News" />
                  <p>{article.description}</p>

                  <button className="button" onClick={() => handleCreateSummary(article, index)}>
                    {summaryLoading[index] ? 'Summarizing...' : showSummary[index] ? 'Hide Summary' : 'Create Summary'}
                  </button>

                  {showSummary[index] && <p className="summary-box">{summaries[index]}</p>}

                  <div style={{ marginTop: '10px' }}>
                    <a href={article.url} target="_blank" rel="noopener noreferrer" style={{ color: '#667eea' }}>
                      Read full article
                    </a>
                  </div>

                  <button
                    className="button"
                    onClick={() => handleSaveArticle(article, index)}
                    disabled={savedArticles[index]}
                    style={{
                      marginTop: '10px',
                      backgroundColor: savedArticles[index] ? 'lightgreen' : '',
                      cursor: savedArticles[index] ? 'default' : 'pointer'
                    }}
                  >
                    {savedArticles[index] ? 'Saved' : 'Save Article'}
                  </button>
                </div>
              )) : <p>No articles available.</p>
            ) : <p>Please select a category and fetch news.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default NewsCategorySelector;

import React, { useState, useEffect } from 'react';
import axios from 'axios';

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

  const [expandedLinkIndex, setExpandedLinkIndex] = useState(null); // State to manage the expanded links

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
  }, [selectedCategory]);

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
  }, [articleLimit]);

  useEffect(() => {
    if (selectedCategory === 'Favorite Topic' && favoriteTopicCategory) {
      fetchNews('', articleLimit, false, true, favoriteTopicCategory);
    }
  }, [favoriteTopicCategory]);

  const handleCategoryChange = (e) => {
    const category = e.target.value;
    setSelectedCategory(category);
    setCustomTopic('');
    setSummaries({});
    setAllNews([]);
    setNewsToShow([]);
    setLastFetchedLimit(0);
    setShowSummary({});
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

  // Toggle the expanded state for RSS links
  const handleToggleExpandedLinks = (index) => {
    setExpandedLinkIndex(expandedLinkIndex === index ? null : index);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '900px', margin: '0 auto' }}>
      <h2 style={{ textAlign: 'center' }}>Select a News Category</h2>
      <select
        onChange={handleCategoryChange}
        value={selectedCategory}
        style={{ padding: '10px', fontSize: '16px', marginBottom: '20px', width: '100%' }}
      >
        <option value="" disabled>Select</option>
        {categories.map(category => (
          <option key={category} value={category}>{category}</option>
        ))}
      </select>

      {selectedCategory === 'Favorite Topic' && (
        <div style={{ marginTop: '10px' }}>
          <label>Select Category:</label>
          <select
            onChange={handleFavoriteTopicCategoryChange}
            value={favoriteTopicCategory}
            style={{ padding: '10px', fontSize: '16px', marginBottom: '20px', width: '100%' }}
          >
            <option value="" disabled>Select Category</option>
            <option value="business">Business</option>
            <option value="technology">Technology</option>
            <option value="sports">Sports</option>
            <option value="science">Science</option>
          </select>
        </div>
      )}

      {selectedCategory === 'Search by Topic' && (
        <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          <input
            type="text"
            placeholder="Enter topic"
            value={customTopic}
            onChange={(e) => setCustomTopic(e.target.value)}
            style={{ padding: '10px', flex: '1 1 200px' }}
          />
          <button onClick={handleCustomTopicSubmit}>Fetch News</button>
        </div>
      )}

      <div style={{ marginTop: '20px' }}>
        <label>Articles to Show: {articleLimit}</label>
        <input
          type="range"
          min="5"
          max={selectedCategory === 'Favorite Topic' ? '15' : '25'}
          step="5"
          value={articleLimit}
          onChange={(e) => setArticleLimit(Number(e.target.value))}
          style={{ width: '100%' }}
        />
      </div>

      <div style={{ marginTop: '30px' }}>
        {loading ? <p>Loading...</p> : (
          hasFetched ? (
            newsToShow.length > 0 ? newsToShow.map((article, index) => (
              <div key={index} style={{
                margin: '20px 0',
                padding: '20px',
                border: '1px solid #ddd',
                borderRadius: '12px',
                backgroundColor: '#fff',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
              }}>
                <h3>{article.title}</h3>
                <p><strong>Publisher:</strong> {article.publisher || article.source?.name}</p>

                {/* Render Credibility Score */}
                <p><strong>Credibility Score:</strong> {article.credibility?.score !== undefined ? article.credibility?.score : 'N/A'}</p>

                {/* Render Matched RSS Links */}
                {article.credibility?.matched_links && article.credibility.matched_links.length > 0 && (
                  <div style={{ margin: '10px 0' }}>
                    <strong>Matched RSS Links:</strong>
                    <button onClick={() => handleToggleExpandedLinks(index)}>
                      {expandedLinkIndex === index ? 'Hide Links' : 'Show Links'}
                    </button>
                    {expandedLinkIndex === index && (
                      <ul style={{ paddingLeft: '20px' }}>
                        {article.credibility.matched_links.map((link, i) => (
                          <li key={i}>
                            <a href={link} target="_blank" rel="noopener noreferrer" style={{ wordBreak: 'break-word' }}>
                              {link}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* Render Image if Available */}
                {article.image && (
                  <img
                    src={article.image}
                    alt={article.title}
                    style={{
                      width: '100%',
                      maxHeight: '400px',
                      objectFit: 'contain',
                      borderRadius: '8px',
                      margin: '10px 0'
                    }}
                  />
                )}

                {/* Render Article Content */}
                <p>{article.content?.slice(0, 200) || 'No content'}...</p>
                <a href={article.url} target="_blank" rel="noreferrer">Read more</a>
                <br />
                
                {/* Handle Summary Creation */}
                <button onClick={() => handleCreateSummary(article, index)} style={{ marginTop: '10px' }}>
                  {summaryLoading[index]
                    ? 'Summarizing...'
                    : summaries[index]
                      ? (showSummary[index] ? 'Hide Summary' : 'Show Summary')
                      : 'Create Summary'}
                </button>

                {/* Render Summary Section */}
                <div
                  style={{
                    maxHeight: showSummary[index] ? '300px' : '0px',
                    overflow: 'hidden',
                    transition: 'max-height 0.5s ease-in-out, padding 0.3s',
                    backgroundColor: '#f9f9f9',
                    padding: showSummary[index] ? '10px' : '0px',
                    marginTop: showSummary[index] ? '10px' : '0',
                    borderRadius: '8px'
                  }}
                >
                  {showSummary[index] && summaries[index] && (
                    <>
                      <h4>Summary</h4>
                      <p>{summaries[index]}</p>
                    </>
                  )}
                </div>
              </div>
            )) : <p>No news found</p>
          ) : null
        )}
      </div>
    </div>
  );
};

export default NewsCategorySelector;

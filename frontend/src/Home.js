import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Home = () => {
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [savedMode, setSavedMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch news by topic (limit 2 articles)
  const fetchNews = async (topic) => {
    if (!topic.trim()) {
      setResults([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`http://localhost:5000/api/news?topic=${encodeURIComponent(topic)}&limit=2`);
      if (!response.ok) throw new Error(`Error: ${response.statusText}`);
      const data = await response.json();
      setResults(data);
      setSavedMode(false);
    } catch (err) {
      setError("Failed to fetch news. Please try again.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch saved articles from backend
  const fetchSavedArticles = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:5000/api/saved-articles');
      if (!response.ok) throw new Error(`Error: ${response.statusText}`);
      const data = await response.json();

      // Normalize link field
      const normalized = data.map(article => ({
        ...article,
        link: article.link || article.url,
      }));

      setResults(normalized);
      setSavedMode(true);
    } catch (err) {
      setError("Failed to load saved articles.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Save article to backend
  const handleSave = async (article) => {
    try {
      const response = await fetch('http://localhost:5000/save_article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: article.title,
          summary: article.summary || article.description || '',
          link: article.url || article.link,
        }),
      });
      const result = await response.json();
      alert(result.message || 'Article saved!');
    } catch (err) {
      alert('Error saving article');
    }
  };

  // Remove saved article from backend (Updated to use DELETE and query param)
  const handleRemove = async (link) => {
    if (!link) {
      alert('Missing article link.');
      return;
    }

    try {
      const url = `http://localhost:5000/api/delete-article?url=${encodeURIComponent(link)}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to delete article');
      const result = await response.json();
      alert(result.message || 'Article removed!');
      fetchSavedArticles(); // Refresh list after removal
    } catch (err) {
      alert('Error removing article');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundImage: 'url("https://images.unsplash.com/photo-1574957747984-82c7fa4eef46?q=80&w=2070&auto=format&fit=crop")',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '40px 20px',
      color: '#fff',
      textShadow: '0 2px 5px rgba(0,0,0,0.7)',
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    }}>
      <h1 style={{ fontSize: '2.8rem', fontWeight: 700, marginBottom: 10 }}>
        Welcome to the Smart News App
      </h1>
      <p style={{ fontSize: '1.15rem', marginBottom: 30 }}>
        Try exploring different topics or click "Explore More" to see trending news!
      </p>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button onClick={() => navigate('/explore')} style={btnStyle('#0077cc')}>
          Explore More
        </button>
        <button onClick={fetchSavedArticles} style={btnStyle('#28a745')}>
          View Saved
        </button>
      </div>

      <div style={{
        display: 'flex',
        gap: 10,
        marginBottom: 30,
        flexWrap: 'wrap',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        padding: '15px 20px',
        borderRadius: 20,
        backdropFilter: 'blur(5px)',
      }}>
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            if (!e.target.value.trim()) {
              setResults([]);
              setError(null);
            }
          }}
          placeholder="Search news topics..."
          style={{
            padding: '14px 18px',
            width: '100%',
            maxWidth: 400,
            fontSize: '16px',
            borderRadius: 25,
            border: '1px solid rgba(0,0,0,0.2)',
            backgroundColor: 'rgba(255,255,255,0.85)',
            color: '#333',
            outline: 'none',
          }}
          spellCheck={false}
        />
        <button onClick={() => fetchNews(search)} style={btnStyle('#0077cc')}>
          Search
        </button>
      </div>

      {loading && <p>Loading...</p>}
      {error && <p style={errorStyle}>{error}</p>}

      <div style={{ maxWidth: 700, width: '100%', textAlign: 'left' }}>
        {results.length === 0 && !loading && !error && (
          <p style={{
            fontStyle: 'italic',
            backgroundColor: 'rgba(255,255,255,0.70)',
            padding: 10,
            borderRadius: 10,
            color: '#000',
          }}>
            Start searching for the latest news from reliable sources.
          </p>
        )}

        {results.map((article, i) => (
          <div key={i} style={{
            backgroundColor: 'rgba(255, 255, 255, 0.85)',
            borderRadius: 12,
            padding: '15px 20px',
            marginBottom: '20px',
            border: '1px solid #ddd',
            color: '#222',
            boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
          }}>
            <h3>{article.title}</h3>
            <p>{article.summary || article.description || 'No summary available.'}</p>
            <a
              href={article.url || article.link}
              target="_blank"
              rel="noreferrer"
              style={{ color: '#0077cc', fontWeight: '600', textDecoration: 'underline' }}
            >
              View Full Article
            </a>
            <p><small>Credibility score: {article.credibility?.score ?? 'N/A'}</small></p>

            <div style={{ marginTop: 10 }}>
              {!savedMode ? (
                <button onClick={() => handleSave(article)} style={btnStyle('#17a2b8')}>
                  Save
                </button>
              ) : (
                <button onClick={() => handleRemove(article.link || article.url)} style={btnStyle('#dc3545')}>
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const btnStyle = (bg) => ({
  backgroundColor: bg,
  color: '#fff',
  border: 'none',
  padding: '12px 20px',
  fontSize: '16px',
  fontWeight: '600',
  borderRadius: 25,
  cursor: 'pointer',
  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
});

const errorStyle = {
  color: '#721c24',
  backgroundColor: 'rgba(255, 235, 235, 0.8)',
  padding: '10px 20px',
  borderRadius: 10,
  marginBottom: 20,
  maxWidth: 600,
  textAlign: 'center',
};

export default Home;

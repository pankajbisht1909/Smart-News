// src/components/SearchNews.js
import React, { useState } from 'react';
import { fetchSearchNews } from '../api';
import NewsCard from './NewsCard';

const SearchNews = () => {
  const [query, setQuery] = useState('');
  const [articles, setArticles] = useState([]);

  const handleSearch = async () => {
    if (query.trim()) {
      const data = await fetchSearchNews(query);
      setArticles(data);
    }
  };

  return (
    <div>
      <h2>Search News</h2>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Enter topic..."
      />
      <button onClick={handleSearch}>Search</button>
      {articles.map((a, i) => <NewsCard key={i} article={a} />)}
    </div>
  );
};

export default SearchNews;

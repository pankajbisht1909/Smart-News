// src/components/TrendingNews.js
import React, { useEffect, useState } from 'react';
import { fetchTrendingNews } from '../api';
import NewsCard from './NewsCard';

const TrendingNews = () => {
  const [articles, setArticles] = useState([]);

  useEffect(() => {
    fetchTrendingNews().then(setArticles);
  }, []);

  return (
    <div>
      <h2>Trending News</h2>
      {articles.map((a, i) => <NewsCard key={i} article={a} />)}
    </div>
  );
};

export default TrendingNews;

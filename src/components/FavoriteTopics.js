// src/components/FavoriteTopics.js
import React, { useEffect, useState } from 'react';
import { fetchFavoriteNews } from '../api';
import NewsCard from './NewsCard';

const FavoriteTopics = () => {
  const [articles, setArticles] = useState([]);

  useEffect(() => {
    fetchFavoriteNews().then(setArticles);
  }, []);

  return (
    <div>
      <h2>Favorite Topics News</h2>
      {articles.map((a, i) => <NewsCard key={i} article={a} />)}
    </div>
  );
};

export default FavoriteTopics;

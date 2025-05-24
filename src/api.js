// src/api.js
const BASE_URL = 'http://localhost:5000/api';

export const fetchTrendingNews = async () => {
  const res = await fetch(`${BASE_URL}/trending`);
  return res.json();
};

export const fetchSearchNews = async (query) => {
  const res = await fetch(`${BASE_URL}/search?q=${encodeURIComponent(query)}`);
  return res.json();
};

export const fetchFavoriteNews = async () => {
  const res = await fetch(`${BASE_URL}/favorites`);
  return res.json();
};

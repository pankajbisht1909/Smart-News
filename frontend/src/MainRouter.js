import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './Home';
import NewsCategorySelector from './App'; // your current App.js component

const MainRouter = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/explore" element={<NewsCategorySelector />} />
      </Routes>
    </Router>
  );
};

export default MainRouter;

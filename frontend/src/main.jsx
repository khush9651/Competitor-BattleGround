import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { bootstrapTheme } from './theme.js';
import './index.css';

bootstrapTheme();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

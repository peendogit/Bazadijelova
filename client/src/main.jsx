import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from './store.jsx';
import App from './App.jsx';
import './styles.css';
import { SRBIJA } from './api.js';
import { pokreniEkavicu } from './ekavica.js';

if (SRBIJA) pokreniEkavicu();

// Instalacija na telefon: service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Provider>
        <App />
      </Provider>
    </BrowserRouter>
  </React.StrictMode>
);

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { installTestHarness } from './testHarness';
import { installPreventZoom } from './utils/preventZoom';

installPreventZoom();

if (import.meta.env.VITE_E2E === 'true') {
  installTestHarness();
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

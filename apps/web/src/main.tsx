import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import './index.css';
import { installTestHarness } from './testHarness';
import { installPreventZoom } from './utils/preventZoom';

installPreventZoom();

if (import.meta.env.VITE_E2E === 'true') {
  installTestHarness();
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);

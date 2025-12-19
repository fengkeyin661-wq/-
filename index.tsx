
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';

// Shim process for environments that don't provide it (like Vite)
// This prevents "ReferenceError: process is not defined" when accessing process.env.API_KEY
if (typeof (window as any).process === 'undefined') {
  (window as any).process = { env: {} };
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

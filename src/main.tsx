import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/app.css';
import { App } from './App';
import { initializeAppLogs } from './services/appLogs';

initializeAppLogs();

const rootElement = document.getElementById('root')!;
rootElement.style.setProperty('--app-version-label', `"Zadiag · v${import.meta.env.VITE_APP_VERSION}"`);

// Lock app to portrait orientation
if (window.screen.orientation) {
  try {
    void window.screen.orientation.lock('portrait-primary').catch(() => undefined);
  } catch {
    // Fallback if orientation lock not supported
  }
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

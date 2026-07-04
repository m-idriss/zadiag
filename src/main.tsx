import React from 'react';
import ReactDOM from 'react-dom/client';
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import './styles/app.css';
import { App } from './App';
import { initializeAppLogs } from './services/appLogs';

initializeAppLogs();

// Lock app to portrait orientation
if (window.screen.orientation) {
  try {
    void window.screen.orientation.lock('portrait-primary').catch(() => undefined);
  } catch {
    // Fallback if orientation lock not supported
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

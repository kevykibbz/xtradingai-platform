import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { DerivProvider } from '@/contexts/DerivContext';
import { ReduxProvider } from '@/store/ReduxProvider';
import { Toaster } from '@/components/ui/toaster';
import App from './App.jsx';
import OAuthCallback from './routes/OAuthCallback.jsx';
import { initLogger } from '@/utils/logger';
import './index.css';

// Initialize console logging to file
initLogger();

// Global error handler for webview - catch network errors and show splash instead
window.addEventListener('error', (event) => {
  // Check if it's a network/loading error
  if (event.message && (
    event.message.includes('Failed to fetch') ||
    event.message.includes('NetworkError') ||
    event.message.includes('Load failed') ||
    event.message.includes('net::ERR')
  )) {
    // Store offline state in sessionStorage so App can detect it
    sessionStorage.setItem('webview_offline', 'true');
    // Prevent default error handling
    event.preventDefault();
  }
});

// Also catch unhandled promise rejections (common with network errors)
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && (
    event.reason.message?.includes('Failed to fetch') ||
    event.reason.message?.includes('NetworkError') ||
    event.reason.message?.includes('Load failed')
  )) {
    sessionStorage.setItem('webview_offline', 'true');
    event.preventDefault();
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ReduxProvider>
      <DerivProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/oauth-callback" element={<OAuthCallback />} />
          </Routes>
          <Toaster />
        </BrowserRouter>
      </DerivProvider>
    </ReduxProvider>
  </React.StrictMode>
);
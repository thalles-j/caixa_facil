import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import { AppDataProvider } from './context/AppDataContext.tsx';
import { applyDarkPreference, getInitialDark } from './lib/theme.ts';

applyDarkPreference(getInitialDark());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AppDataProvider>
          <App />
        </AppDataProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);

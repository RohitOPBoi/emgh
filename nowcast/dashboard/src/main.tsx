import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import HomePage from './HomePage.tsx'

function Root() {
  const [view, setView] = useState<'home' | 'dashboard'>(() => {
    // Check initial path: /dashboard goes straight to dashboard
    const path = window.location.pathname;
    if (path === '/dashboard' || path === '/dashboard/') return 'dashboard';
    return 'home';
  });

  useEffect(() => {
    // Apply body class for scroll control
    document.body.classList.toggle('dashboard-view', view === 'dashboard');
    document.body.classList.toggle('home-view', view === 'home');
  }, [view]);

  useEffect(() => {
    const onPop = () => {
      const path = window.location.pathname;
      if (path === '/dashboard' || path === '/dashboard/') {
        setView('dashboard');
      } else {
        setView('home');
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  function goToDashboard() {
    window.history.pushState({}, '', '/dashboard');
    setView('dashboard');
  }

  if (view === 'dashboard') {
    return <App />;
  }
  return <HomePage onNavigateToDashboard={goToDashboard} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)

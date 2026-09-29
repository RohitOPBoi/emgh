import { StrictMode, Suspense, lazy, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './fonts.css'
import './index.css'
// Route-level code splitting: the landing page and the map console are
// separate bundles, so visiting one never downloads the other (MapLibre is
// the bulk of the console).
const App = lazy(() => import('./App.tsx'))
const HomePage = lazy(() => import('./HomePage.tsx'))

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

  return (
    <Suspense fallback={<div className="boot-splash" role="status" aria-label="Loading Agrim" />}>
      {view === 'dashboard' ? <App /> : <HomePage onNavigateToDashboard={goToDashboard} />}
    </Suspense>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)

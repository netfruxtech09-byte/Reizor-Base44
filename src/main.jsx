import React from 'react'
import ReactDOM from 'react-dom/client'

// Suppress unhandled 401 rejections silently — background/page-load API calls should
// never open the auth modal. The modal is only triggered by explicit useAuthGate calls
// (requireAuth / guardedAction) on direct user-initiated protected actions.
window.addEventListener('unhandledrejection', (event) => {
  const err = event.reason;
  const is401 =
    err?.status === 401 ||
    err?.response?.status === 401 ||
    (typeof err?.message === 'string' && err.message.includes('401'));
  if (is401) {
    event.preventDefault(); // suppress console noise — do NOT show modal
  }
});
import App from '@/App.jsx'
import '@/index.css'

if ('serviceWorker' in navigator && !import.meta.env.DEV) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('Service Worker registered'))
      .catch(err => console.log('SW registration failed:', err));
  });
} else if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  // Unregister any existing service workers in dev mode to prevent cache issues
  navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(reg => reg.unregister());
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
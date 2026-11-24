import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { supabase, verifySupabaseConnection } from './lib/supabase.js';
import './styles.css';

if (supabase) {
  verifySupabaseConnection()
    .then(() => console.info('Supabase project endpoint is reachable.'))
    .catch((error) => console.error('Supabase connection failed.', error));
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

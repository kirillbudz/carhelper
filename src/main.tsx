import WebApp from '@twa-dev/sdk';

WebApp.ready();
console.log('Telegram WebApp initialized:', WebApp.initData);
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

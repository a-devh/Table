import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'mana-font/css/mana.min.css';
import 'keyrune/css/keyrune.min.css';
import './index.css';
import { Container } from './app/Container';
import { startTheme } from './settings/theme';
import { startLocalSync } from './local/syncTable';

startTheme();
startLocalSync();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Container />
  </StrictMode>,
);

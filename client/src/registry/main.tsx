import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../theme.css';
import './registry.css';
import { RegistryApp } from './RegistryApp';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RegistryApp />
  </StrictMode>,
);

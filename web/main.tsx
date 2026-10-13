import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Editor from '../app/editor';
import '../app/globals.css';
import '../app/industrial.css';
import '../app/audit.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Editor />
  </StrictMode>,
);

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/zilla-slab/300-italic.css';
import '@fontsource/zilla-slab/400.css';
import '@fontsource/zilla-slab/500.css';
import '@fontsource/zilla-slab/600.css';
import './index.css';
import App from './App';

// The layout is fluid from 1280x720 to 1920x1080 (rail and right column use clamp()), so the
// whole-UI zoom that 96dad9b added below 1440x900 is no longer needed.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

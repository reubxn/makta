import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import './index.css';
import App from './App';

// The UI is designed for a 1440x900 projector. On smaller windows (small laptops, 1024x768 projectors,
// high OS scaling) scale the whole UI down proportionally instead of letting panels overlap.
const DESIGN_W = 1440;
const DESIGN_H = 900;
function fitZoom() {
  const z = Math.max(0.5, Math.min(1, window.innerWidth / DESIGN_W, window.innerHeight / DESIGN_H));
  const root = document.getElementById('root')!;
  root.style.zoom = z === 1 ? '' : String(z);
  document.documentElement.style.setProperty('--ui-zoom', String(z));
}
fitZoom();
window.addEventListener('resize', fitZoom);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

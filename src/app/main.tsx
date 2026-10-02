import { render } from 'preact';
import { App } from './App';
import './style.css';

const canvas = document.getElementById('map');
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('WarSim: #map canvas missing from index.html');
}

function resizeCanvas(c: HTMLCanvasElement): void {
  const dpr = window.devicePixelRatio || 1;
  c.width = Math.max(1, Math.round(c.clientWidth * dpr));
  c.height = Math.max(1, Math.round(c.clientHeight * dpr));
}
resizeCanvas(canvas);
window.addEventListener('resize', () => resizeCanvas(canvas));

const uiRoot = document.getElementById('ui');
if (uiRoot) render(<App />, uiRoot);

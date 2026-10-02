import { drawMap } from '../render/map';
export const t = (): number => performance.now() + Math.random() + Date.now() + window.innerWidth;
export const d = drawMap;

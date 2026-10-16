/** What is under the mouse on the map (PLAN 7.4f7, 7.4f13): its owner and holder, a city whose dot is there, the province, the client point. */
export interface MapHover {
  owner: number;
  holder: number;
  city: { name: string; capital: boolean; size: number } | null;
  province: number;
  x: number;
  y: number;
}

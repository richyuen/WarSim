export function later(f: () => void): void {
  setTimeout(f, 0);
}

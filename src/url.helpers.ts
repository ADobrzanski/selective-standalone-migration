export function dropInitialShash(path: string): string {
  return path.startsWith("/") ? path.substring(1) : path;
}

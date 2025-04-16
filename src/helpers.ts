export function getAtPath<T extends object>(obj: T, path: string): any {
  let currentRoot: any = obj;

  const pathSegments = path.split("/");
  for (let segment of pathSegments) {
    if (segment in currentRoot) {
      currentRoot = currentRoot[segment];
    } else {
      currentRoot = undefined;
      break;
    }
  }

  return currentRoot;
}

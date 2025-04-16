export function scss(css) {
  const styleTag = document.createElement("style");
  styleTag.innerText = css;
  return styleTag;
}

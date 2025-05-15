import { html, useEffect, useRef } from "https://esm.sh/htm/preact/standalone";
import { Tree } from "./tree-graph.js";

const styles = {
  display: "block",
  width: "100%",
  height: "500px",
};

export const DependencyChart = function ({ data, onNodeSuperClick }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!data || !containerRef.current) return;

    const graph = Tree(data, {
      width: 1200,
      height: 500,
      label: (d) => d.name,
      onNodeCommandClick: (_e, node) => {
        onNodeSuperClick?.(node.data);
      },
    });

    removeAllChildren(containerRef.current);
    containerRef.current.appendChild(graph);
  }, [data, onNodeSuperClick]);

  return html`<div ref=${containerRef} style=${styles}></div>`;
};

function removeAllChildren(node) {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

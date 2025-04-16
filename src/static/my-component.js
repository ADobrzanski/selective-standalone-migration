import { scss } from "./utils.js";
import { Tree } from "./tree-graph.js";

const styles = scss`
  :host {
    display: block;
    width: 100%;
    height: 500px;
  }
`;

class DependencyChart extends HTMLElement {
  static get observedAttributes() {
    return ["data"];
  }

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: "open" });
    this.shadow.appendChild(styles);
  }

  attributeChangedCallback(name, _, newValue) {
    switch (name) {
      case "data":
        try {
          this.data = JSON.parse(newValue);
          console.table(this.data);
        } catch (e) {
          console.error(e);
        }
        break;
    }

    this.render();
  }

  emitNodeSuperClick(detail) {
    const event = new CustomEvent("node-super-click", {
      detail,
      bubbles: true,
      cancelable: true,
    });
    this.dispatchEvent(event);
  }

  render() {
    const graph = Tree(this.data, {
      width: 1200,
      height: 500,
      label: (d) => d.name,
      onNodeCommandClick: (_e, node) => this.emitNodeSuperClick(node.data),
    });
    if (this.root) {
      this.shadow.replaceChild(graph, this.root);
    } else {
      this.shadow.appendChild(graph);
    }

    this.root = graph;
  }
}

// Register component upon import
(() => customElements.define("my-chart", DependencyChart))();

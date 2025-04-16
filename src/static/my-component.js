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
          console.log(this.data);
        } catch (e) {
          console.error(e);
        }
        break;
    }

    this.render();
  }

  render() {
    const graph = Tree(this.data, {
      width: this.shadow.host.clientWidth,
      height: 500,
      label: (d) => d.name,
    });
    if (this.root) {
      this.shadow.replaceChild(this.root, graph);
    } else {
      this.shadow.appendChild(graph);
    }
    this.root = graph;
  }
}

// Register component upon import
(() => customElements.define("my-chart", DependencyChart))();

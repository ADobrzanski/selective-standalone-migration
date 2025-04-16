// Copyright 2021-2023 Observable, Inc.
// Released under the ISC license.
// https://observablehq.com/@d3/tree
// --- MODIFIED to include zoom/pan and fix scaling ---
export function Tree(
  data,
  {
    // data is either tabular (array of objects) or hierarchy (nested objects)
    path, // as an alternative to id and parentId, returns an array identifier, imputing internal nodes
    id = Array.isArray(data) ? (d) => d.id : null, // if tabular data, given a d in data, returns a unique identifier (string)
    parentId = Array.isArray(data) ? (d) => d.parentId : null, // if tabular data, given a node d, returns its parent's identifier
    children, // if hierarchical data, given a d in data, returns its children
    tree = d3.tree, // layout algorithm (typically d3.tree or d3.cluster)
    sort, // how to sort nodes prior to layout (e.g., (a, b) => d3.descending(a.height, b.height))
    label, // given a node d, returns the display name
    title, // given a node d, returns its hover text
    link, // given a node d, its link (if any)
    linkTarget = "_blank", // the target attribute for links (if any)
    width = 640, // outer width, in pixels (defines SVG viewport width)
    height = 400, // outer height, in pixels (defines SVG viewport height)
    dx = 20, // vertical separation between nodes <<< Fixed value
    dy = 180, // horizontal separation between levels <<< Fixed value (adjust as needed)
    r = 3, // radius of nodes
    padding = 1, // (Not directly used in nodeSize layout, but conceptually useful)
    fill = "#999", // fill for nodes
    fillOpacity, // fill opacity for nodes
    stroke = "#555", // stroke for links
    strokeWidth = 1.5, // stroke width for links
    strokeOpacity = 0.4, // stroke opacity for links
    strokeLinejoin, // stroke line join for links
    strokeLinecap, // stroke line cap for links
    halo = "#fff", // color of label halo
    haloWidth = 3, // padding around the labels (increased slightly for visibility)
    curve = d3.curveBumpX, // curve for the link
    collapsedFill = "#555", // fill for collapsed nodes
    expandedFill = "#999", // fill for expanded nodes
    duration = 300, // transition duration
    onNodeCommandClick, // Handler for Command/Ctrl + Left Click
    zoomScaleExtent = [0.1, 10], // Min/max zoom scale
  } = {},
) {
  // If id and parentId options are specified, or the path option, use d3.stratify
  // to convert tabular data to a hierarchy; otherwise we assume that the data is
  // specified as an object {children} with nested objects (a.k.a. the "flare.json"
  // format), and use d3.hierarchy.
  function createRoot() {
    return path != null
      ? d3.stratify().path(path)(data)
      : id != null || parentId != null
        ? d3.stratify().id(id).parentId(parentId)(data)
        : d3.hierarchy(data, children);
  }

  const root = createRoot();

  // Sort the nodes.
  if (sort != null) root.sort(sort);

  // Store original children for collapsing/expanding
  root.descendants().forEach((d, i) => {
    d.id = d.id || `node-${i}`; // Ensure all nodes have an ID for data binding
    d._children = d.children;
    // Start with all nodes expanded (or handle initial collapse state if needed)
    // if (d.depth > 0) d.children = null; // Example: Start collapsed except root
    d.collapsed = !d.children;
    // Initialize positions to prevent jumpy transitions
    d.x0 = 0;
    d.y0 = 0;
  });

  // Compute labels and titles for all nodes, including hidden ones
  // We need the full hierarchy to compute labels correctly if using indices
  const allNodesForLabels = root.descendants();
  const L =
    label == null ? null : allNodesForLabels.map((d) => label(d.data, d));

  // Compute the layout using fixed node sizes.
  // dx controls vertical separation, dy controls horizontal separation.
  const treeLayout = tree().nodeSize([dx, dy]); // <<< Use nodeSize

  // --- Calculate extent based on the *full* potential tree ---
  // Create a temporary full hierarchy to determine maximum bounds
  let tempRoot = createRoot();
  if (sort != null) tempRoot.sort(sort);
  treeLayout(tempRoot); // Apply layout to the temporary full tree

  // Calculate the extent of the full layout
  function calcViewBox(root) {
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;

    root.each((d) => {
      if (d.x < x0) x0 = d.x;
      if (d.x > x1) x1 = d.x;
      if (d.y < y0) y0 = d.y;
      if (d.y > y1) y1 = d.y;
    });

    // Calculate the dimensions needed for the viewBox
    // Add margins to the calculated extent
    const viewBoxWidth = y1 - y0 + 400;
    const viewBoxHeight = x1 - x0;
    const viewBoxX = y0 - 200; // Top-left corner x (horizontal)
    const viewBoxY = x0; // Top-left corner y (vertical)

    return [viewBoxX, viewBoxY, viewBoxWidth, viewBoxHeight];
  }

  // --- Initial layout for the visible tree ---
  // Apply layout to the actual root used for display (might have collapsed nodes)
  treeLayout(root);

  const [viewBoxX, viewBoxY, viewBoxWidth, viewBoxHeight] =
    calcViewBox(tempRoot);

  // Set initial positions for root (needed for the first update transition)
  root.x0 = viewBoxY + viewBoxHeight / 2; // Start root in middle vertically
  root.y0 = viewBoxX; // Start root at the beginning horizontally

  // Create container SVG
  const svg = d3
    .create("svg")
    .attr("width", width) // Use user-provided width for SVG element size
    .attr("height", height) // Use user-provided height for SVG element size
    .attr("viewBox", calcViewBox(tempRoot)) // <<< Set viewBox based on full tree extent
    .attr("style", "max-width: 100%; font: 10px sans-serif;"); // Use 'font' shorthand

  // Create a group element for zoom transformations
  const zoomGroup = svg.append("g");

  // Add groups for links and nodes *inside* the zoom group
  const linkGroup = zoomGroup
    .append("g")
    .attr("fill", "none")
    .attr("stroke", stroke)
    .attr("stroke-opacity", strokeOpacity)
    .attr("stroke-linecap", strokeLinecap)
    .attr("stroke-linejoin", strokeLinejoin)
    .attr("stroke-width", strokeWidth);

  const nodeGroup = zoomGroup
    .append("g")
    .attr("cursor", "pointer") // Add pointer cursor to nodes group
    .attr("pointer-events", "all"); // Ensure group catches events

  // Define the zoom behavior
  const zoom = d3
    .zoom()
    .scaleExtent(zoomScaleExtent)
    .on("zoom", (event) => {
      zoomGroup.attr("transform", event.transform);
    });

  // Attach zoom behavior to the SVG
  svg.call(zoom);

  // --- Update Function ---
  function update(source) {
    const nodes = root.descendants().reverse(); // Reverse for correct rendering order (parents on top)
    const links = root.links();

    // Compute the new tree layout.
    treeLayout(root);

    // Calculate transitions
    const transition = svg
      .transition()
      .duration(duration)
      .tween(
        "resize",
        window.ResizeObserver ? null : () => () => svg.dispatch("toggle"),
      ); // Optional: for older browser compatibility?

    // Update the nodes…
    const node = nodeGroup.selectAll("g.node").data(nodes, (d) => d.id);

    // Enter any new nodes at the parent's previous position.
    const nodeEnter = node
      .enter()
      .append("g")
      .attr("class", "node")
      .attr("transform", `translate(${source.y0},${source.x0})`)
      .attr("fill-opacity", 0)
      .attr("stroke-opacity", 0)
      .on("click", (event, d) => {
        if (event.defaultPrevented) return; // Skip if zoom drag

        if (
          (event.metaKey || event.ctrlKey) &&
          typeof onNodeCommandClick === "function"
        ) {
          onNodeCommandClick(event, d);
        } else if (d._children || d.children) {
          // Toggle collapse/expand only if it has children (original or current)
          d.collapsed = !d.collapsed;
          d.children = d.collapsed ? null : d._children;
          update(d); // Pass the clicked node as the source
        }
      });

    nodeEnter
      .append("circle")
      .attr("r", r)
      .attr("fill", (d) =>
        d._children ? (d.collapsed ? collapsedFill : expandedFill) : fill,
      )
      .attr("stroke-width", 10); // Make circle easier to click

    if (L) {
      nodeEnter
        .append("text")
        .attr("dy", "0.31em")
        .attr("x", (d) => (d._children ? -r - 4 : r + 4)) // Position based on radius
        .attr("text-anchor", (d) => (d._children ? "end" : "start"))
        .text((d, i) => {
          // Find the correct index in the original allNodesForLabels array
          const index = allNodesForLabels.findIndex((node) => node.id === d.id);
          return index !== -1 && index < L.length ? L[index] : "";
        })
        .attr("paint-order", "stroke")
        .attr("stroke", halo)
        .attr("stroke-width", haloWidth);
    }

    // Add titles for the nodes
    if (title != null) {
      nodeEnter.append("title").text((d) => title(d.data, d));
    }

    // Transition nodes to their new position.
    const nodeUpdate = node
      .merge(nodeEnter)
      .transition(transition)
      .attr("transform", (d) => `translate(${d.y},${d.x})`)
      .attr("fill-opacity", 1)
      .attr("stroke-opacity", 1);

    // Update circle fill based on collapsed state
    nodeUpdate
      .select("circle")
      .attr("fill", (d) =>
        d._children ? (d.collapsed ? collapsedFill : expandedFill) : fill,
      );

    // Transition exiting nodes to the parent's new position.
    const nodeExit = node
      .exit()
      .transition(transition)
      .remove()
      .attr("transform", `translate(${source.y},${source.x})`)
      .attr("fill-opacity", 0)
      .attr("stroke-opacity", 0);

    // Update the links…
    const link = linkGroup.selectAll("path").data(links, (d) => d.target.id);

    // Enter any new links at the parent's previous position.
    const linkEnter = link
      .enter()
      .append("path")
      .attr("d", (d) => {
        const o = { x: source.x0, y: source.y0 };
        return d3
          .link(curve)
          .x((d) => d.y)
          .y((d) => d.x)({ source: o, target: o });
      });

    // Transition links to their new position.
    link
      .merge(linkEnter)
      .transition(transition)
      .attr(
        "d",
        d3
          .link(curve)
          .x((d) => d.y)
          .y((d) => d.x),
      );

    // Transition exiting nodes to the parent's new position.
    link
      .exit()
      .transition(transition)
      .remove()
      .attr("d", (d) => {
        const o = { x: source.x, y: source.y }; // Use source's *current* position
        return d3
          .link(curve)
          .x((d) => d.y)
          .y((d) => d.x)({ source: o, target: o });
      });

    // Stash the old positions for transition.
    root.eachBefore((d) => {
      d.x0 = d.x;
      d.y0 = d.y;
    });
  }

  // Initial draw
  update(root);

  return svg.node();
}

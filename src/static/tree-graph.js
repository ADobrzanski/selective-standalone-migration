// Copyright 2021-2023 Observable, Inc.
// Released under the ISC license.
// https://observablehq.com/@d3/tree
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
    width = 640, // outer width, in pixels
    height, // outer height, in pixels
    r = 3, // radius of nodes
    padding = 1, // horizontal padding for first and last column
    fill = "#999", // fill for nodes
    fillOpacity, // fill opacity for nodes
    stroke = "#555", // stroke for links
    strokeWidth = 1.5, // stroke width for links
    strokeOpacity = 0.4, // stroke opacity for links
    strokeLinejoin, // stroke line join for links
    strokeLinecap, // stroke line cap for links
    halo = "#fff", // color of label halo
    haloWidth = 0, // padding around the labels
    curve = d3.curveBumpX, // curve for the link
    collapsedFill = "#555", // fill for collapsed nodes
    expandedFill = "#999", // fill for expanded nodes
    duration = 300, // transition duration
    marginTop = 20, // top margin in pixels
    marginRight = 150, // right margin in pixels (increased to prevent overflow)
    marginBottom = 20, // bottom margin in pixels
    marginLeft = 60, // left margin in pixels (increased to prevent overflow)
  } = {},
) {
  // If id and parentId options are specified, or the path option, use d3.stratify
  // to convert tabular data to a hierarchy; otherwise we assume that the data is
  // specified as an object {children} with nested objects (a.k.a. the "flare.json"
  // format), and use d3.hierarchy.
  const root =
    path != null
      ? d3.stratify().path(path)(data)
      : id != null || parentId != null
        ? d3.stratify().id(id).parentId(parentId)(data)
        : d3.hierarchy(data, children);

  // Sort the nodes.
  if (sort != null) root.sort(sort);

  // Store original children for collapsing/expanding
  root.descendants().forEach((d) => {
    d._children = d.children;
    // Start with all nodes expanded
    d.collapsed = false;
    // Initialize positions to prevent jumpy transitions
    d.x0 = 0;
    d.y0 = 0;
  });

  // Compute labels and titles for all nodes, including hidden ones
  let allNodes = root.descendants();
  const L = label == null ? null : allNodes.map((d) => label(d.data, d));

  // Compute the layout.
  const dx = 10;
  // Adjust dynamic width calculation to prevent overflow
  const dy = (width - marginLeft - marginRight) / (root.height + padding);
  const treeLayout = tree().nodeSize([dx, dy]);

  // Initial layout calculation
  treeLayout(root);

  // Calculate initial extent to establish stable viewBox
  let initialX0 = Infinity;
  let initialX1 = -Infinity;
  let initialY0 = Infinity;
  let initialY1 = -Infinity;

  // Create a complete tree to calculate maximum possible extent
  let fullTreeRoot = d3.hierarchy(data, children);
  if (sort != null) fullTreeRoot.sort(sort);

  // Apply tree layout to the full tree
  treeLayout(fullTreeRoot);

  // Calculate the full extent
  fullTreeRoot.each((d) => {
    if (d.x < initialX0) initialX0 = d.x;
    if (d.x > initialX1) initialX1 = d.x;
    if (d.y < initialY0) initialY0 = d.y;
    if (d.y > initialY1) initialY1 = d.y;
  });

  // Add margins to ensure everything stays visible
  initialX0 -= marginTop;
  initialX1 += marginBottom;
  initialY0 -= marginLeft;
  initialY1 += marginRight;

  // Calculate stable dimensions with added margins
  const stableHeight = initialX1 - initialX0;
  const stableWidth = initialY1 - initialY0;

  // Create container SVG with stable dimensions
  const container = d3
    .create("svg")
    .attr("width", width)
    .attr("height", height === undefined ? stableHeight : height)
    .attr("viewBox", [initialY0, initialX0, stableWidth, stableHeight])
    .attr("style", "max-width: 100%; height: auto; height: intrinsic;")
    .attr("font-family", "sans-serif")
    .attr("font-size", 10)
    .node();

  // Add groups for links and nodes
  d3.select(container)
    .append("g")
    .attr("class", "links")
    .attr("fill", "none")
    .attr("stroke", stroke)
    .attr("stroke-opacity", strokeOpacity)
    .attr("stroke-linecap", strokeLinecap)
    .attr("stroke-linejoin", strokeLinejoin)
    .attr("stroke-width", strokeWidth);

  d3.select(container).append("g").attr("class", "nodes");

  // Helper function to update the tree layout
  function update(source) {
    // Apply tree layout to current visible nodes
    treeLayout(root);

    // Get all nodes and links
    const nodes = root.descendants();
    const links = root.links();

    // Update the links
    const linkGroup = d3.select(container).select(".links");
    const link = linkGroup
      .selectAll("path")
      .data(
        links,
        (d) =>
          d.target.id ||
          (d.target.id = Math.random().toString(36).substr(2, 9)),
      );

    // Enter new links at parent's previous position
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

    // Update links with transition
    link
      .merge(linkEnter)
      .transition()
      .duration(duration)
      .attr(
        "d",
        d3
          .link(curve)
          .x((d) => d.y)
          .y((d) => d.x),
      );

    // Remove old links with transition
    link
      .exit()
      .transition()
      .duration(duration)
      .attr("d", (d) => {
        const o = { x: source.x, y: source.y };
        return d3
          .link(curve)
          .x((d) => d.y)
          .y((d) => d.x)({ source: o, target: o });
      })
      .remove();

    // Update the nodes
    const nodeGroup = d3.select(container).select(".nodes");
    const node = nodeGroup
      .selectAll("g.node")
      .data(
        nodes,
        (d) => d.id || (d.id = Math.random().toString(36).substr(2, 9)),
      );

    // Enter new nodes at the parent's previous position
    const nodeEnter = node
      .enter()
      .append("g")
      .attr("class", "node")
      .attr("transform", (d) => `translate(${source.y0},${source.x0})`)
      .on("click", (event, d) => {
        // Toggle children on click
        if (d._children) {
          d.collapsed = !d.collapsed;
          d.children = d.collapsed ? null : d._children;
          update(d);
        }
      });

    // Add Circle for the nodes
    nodeEnter
      .append("circle")
      .attr("r", 0)
      .attr("fill", (d) =>
        d._children ? (d.collapsed ? collapsedFill : expandedFill) : fill,
      )
      .attr("cursor", (d) => (d._children ? "pointer" : "default"));

    // Add labels for the nodes
    if (L) {
      nodeEnter
        .append("text")
        .attr("dy", "0.32em")
        .attr("x", (d) => (d.children ? -6 : 6))
        .attr("text-anchor", (d) => (d.children ? "end" : "start"))
        .attr("paint-order", "stroke")
        .attr("stroke", halo)
        .attr("stroke-width", haloWidth)
        .attr("opacity", 0)
        .text((d, i) => {
          const index = allNodes.findIndex((node) => node.data === d.data);
          return index !== -1 && index < L.length ? L[index] : "";
        });
    }

    // Add titles for the nodes
    if (title != null) {
      nodeEnter.append("title").text((d) => title(d.data, d));
    }

    // UPDATE
    const nodeUpdate = nodeEnter.merge(node);

    // Transition to the proper position for the nodes
    nodeUpdate
      .transition()
      .duration(duration)
      .attr("transform", (d) => `translate(${d.y},${d.x})`);

    // Update the node attributes and style
    nodeUpdate
      .select("circle")
      .attr("r", r)
      .attr("fill", (d) =>
        d._children ? (d.collapsed ? collapsedFill : expandedFill) : fill,
      )
      .attr("cursor", (d) => (d._children ? "pointer" : "default"));

    if (L) {
      nodeUpdate
        .select("text")
        .transition()
        .duration(duration)
        .attr("opacity", 1)
        .attr("x", (d) => (d.children ? -6 : 6))
        .attr("text-anchor", (d) => (d.children ? "end" : "start"));
    }

    // Remove any exiting nodes with transition
    const nodeExit = node
      .exit()
      .transition()
      .duration(duration)
      .attr("transform", (d) => `translate(${source.y},${source.x})`)
      .remove();

    // Reduce the node circles size to 0
    nodeExit.select("circle").attr("r", 0);

    // Fade out the text
    nodeExit.select("text").attr("opacity", 0);

    // Store the old positions for transition
    nodes.forEach((d) => {
      d.x0 = d.x;
      d.y0 = d.y;
    });
  }

  // Initialize the display
  update(root);

  return container;
}

import { IncomingMessage, Server, ServerResponse } from "http";
import { ScriptContext } from "../main";
import { getAtPath } from "../helpers";
import { getDocument, getLink } from "../html.helpers";
import { getAllChildren, getLocalNodeId, isSourceFile } from "../tsc.helpers";
import ts from "typescript";

export const handleFile = (
  url: URL,
  _req: IncomingMessage,
  res: ServerResponse<IncomingMessage>,
  _server: Server,
  context: ScriptContext,
) => {
  const fsPathSegment = url.pathname.substring(1);
  const fsPath = url.searchParams.get("path") ?? fsPathSegment;
  const fsTreeNode = !fsPath
    ? context.source.tree
    : getAtPath(context.source.tree, fsPath);

  const getTreeLink = (fsPathSegment: string) => {
    const href = encodeURIComponent(
      [fsPath, fsPathSegment].filter((_) => _).join("/"),
    );
    const label = fsPathSegment;
    return getLink({ href: `?path=${href}`, label }) + "<br>";
  };

  const html = isSourceFile(fsTreeNode)
    ? renderFile(fsTreeNode as ts.SourceFile)
    : Object.entries(fsTreeNode).map(([fsPathSegment]) =>
        getTreeLink(fsPathSegment),
      );

  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(`
          <!DOCTYPE html>
          <html>
          <body>
            ${html}
          </body>
          </html>
        `);
};

const renderFile = (tsFile: ts.SourceFile): string => {
  const css = `
      .columns {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
      }

      .node {
        margin-left: 8px;
      }
    `;

  const content = `
      <div class="columns">
        <pre class="scroll">${tsFile.text}</pre>
        <div class="scroll">${getAllChildren(tsFile).map(renderNode).join("")}</div>
        <pre id="node" class="scroll"></pre>
      </div>
    `;

  return getDocument(content, css);
};

const renderNode = (node: ts.Node): string => {
  const filePath = encodeURIComponent(node.getSourceFile().fileName);

  return `
      <div class="node">
        <div hx-get="file/${filePath}/node/${getLocalNodeId(node)}" hx-target="#node">${ts.SyntaxKind[node.kind]}</div>
        ${getAllChildren(node).map(renderNode).join("")}
      </div>
    `;
};

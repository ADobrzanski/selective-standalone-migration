import { IncomingMessage, Server, ServerResponse } from "http";
import { getAtPath } from "../../helpers";
import { ScriptContext } from "../../main";
import ts, { SyntaxKind, isSourceFile } from "typescript";
import { getAllChildrenDeep, getLocalNodeId } from "../../tsc.helpers";
import { getTag } from "../../html.helpers";
import { isObject } from "../../ts.helpers";

export const handleNodeInFile = (
  _url: URL,
  _req: IncomingMessage,
  res: ServerResponse<IncomingMessage>,
  _server: Server,
  context: ScriptContext,
) => {
  const [_0, _fsPath, _2, nodeId] = _url.pathname.substring(1).split("/");
  const fsPath = decodeURIComponent(_fsPath).substring(1);
  console.log("fsPath", fsPath);
  const fsTreeNode = getAtPath(context.source.tree, fsPath);

  if (!isSourceFile(fsTreeNode)) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Path does not point to the file.");
    return;
  }

  const children: ts.Node[] = getAllChildrenDeep(fsTreeNode);

  const node = children.find((_node) => getLocalNodeId(_node) === nodeId);
  if (!node) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end(`There is no node with id = ${nodeId} in ${fsPath}.`);
    return;
  }

  const entriesHTML = shallowStringifyToHTML(node);
  const symbol = context.checker.ts.getSymbolAtLocation(node);
  const symbolHTML = symbol ? shallowStringifyToHTML(symbol) : "";

  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(
    [entriesHTML, getTag("div", undefined, "Symbol: ------"), symbolHTML].join(
      "",
    ),
  );
};

const shallowStringifyToHTML = <T extends {}>(x: T): string => {
  const entries = Object.entries(x);

  return entries.reduce((acc, [key, value]) => {
    const valueString: string = isObject(value)
      ? value["constructor"]["name"]
      : key === "kind" && typeof value === "number"
        ? SyntaxKind[value]
        : value + "";

    return acc + `<div>${key}: ${valueString}</div>`;
  }, "");
};

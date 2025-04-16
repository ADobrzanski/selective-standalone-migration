import { IncomingMessage, ServerResponse } from "http";
import path from "path";
import fs from "fs";

export const handleGraph = (
  _url: URL,
  _req: IncomingMessage,
  res: ServerResponse<IncomingMessage>,
) => {
  // Define the path to the JavaScript file
  const filePath = path.join(__dirname, "templates/graph.html");

  // Read the JavaScript file
  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) {
      console.log(err);
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Cannot load template file");
      return;
    }

    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(data);
  });
};

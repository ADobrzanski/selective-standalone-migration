import { IncomingMessage, ServerResponse } from "http";
import path from "path";
import fs from "fs";

export const handleStatic = (
  _url: URL,
  _req: IncomingMessage,
  res: ServerResponse<IncomingMessage>,
) => {
  const [_0, fileName] = _url.pathname.substring(1).split("/");
  const extention = fileName.split(".")[1];
  // Define the path to the JavaScript file
  const filePath = path.join(__dirname, `static/${fileName}`);

  // Read the JavaScript file
  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) {
      console.log(err);
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Cannot load template file");
      return;
    }

    switch (extention) {
      case "html":
        res.writeHead(200, { "Content-Type": "text/html" });
        break;
      case "js":
        res.writeHead(200, { "Content-Type": "text/javascript" });
        break;
      default:
        throw new Error("Unsupported file extension");
    }

    res.end(data);
  });
};

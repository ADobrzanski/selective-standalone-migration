import { IncomingMessage, ServerResponse, Server } from "http";

export const handleShutdown = (
  _url: URL,
  _req: IncomingMessage,
  res: ServerResponse<IncomingMessage>,
  server: Server,
) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Server is shutting down...");

  // Close the server after the response is sent
  setTimeout(() => {
    server.close(() => {
      console.log("Server has been shut down.");
    });
  }, 100);
};

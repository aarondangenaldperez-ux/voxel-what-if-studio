import { createAppServer } from "./httpServer.js";

const port = Number(process.env.PORT || 8787);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be a valid TCP port.");
}

const server = createAppServer();
server.listen(port, "0.0.0.0", () => {
  console.log("Voxel What If Studio AI service listening on port " + port);
});

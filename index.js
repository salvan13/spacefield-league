import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { main } from "./lib/main.js";

const app = express();
const server = createServer(app);
const io = new Server(server);

app.set("port", process.env.PORT || 3000);
app.use(express.static("public"));
app.use(express.static("shared"));
io.on("connection", main);

server.listen(app.get("port"), () => {
  console.log(`Server started on port ${app.get("port")}`);
});

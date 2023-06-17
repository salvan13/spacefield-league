import { cleanString } from "./utils.js";
import { Match } from "./match.js";

const rooms = {};

setInterval(() => {
  for (const r in rooms) {
    if (rooms[r].s.m._.ended) {
      delete rooms[r];
    }
  }
}, 10 * 1000);

export const main = (socket) => {
  const cid = socket.handshake.query.cid;
  const name = cleanString(socket.handshake.query.name.substr(0, 12));
  const roomName = cleanString((socket.handshake.query.room || "training").substr(0, 14));
  let players = parseInt(socket.handshake.query.playersNr || 0);
  const vehicle = socket.handshake.query.v;
  const isTraining = roomName == "training";

  if (!rooms[roomName] || rooms[roomName].s.m._.ended || (rooms[roomName].isFull() && isTraining)) {
    if (players == 0 && rooms[roomName]) {
      players = rooms[roomName].s.m._.maxp;
    }
    if (!players) {
      players = 20;
    }
    rooms[roomName] = new Match({ name: roomName, maxp: players, minp: isTraining ? 1 : players, isTraining });
    console.log("new match", rooms[roomName].s.m._.id, roomName);
  }

  socket.m = rooms[roomName];

  socket.on("disconnect", () => {
    if (socket.m.s.p[socket.id]) {
      socket.m.s.p[socket.id].deleted = true;
      socket.m.broadcast();
      delete socket.m.s.p[socket.id];
    } else if (socket.m.s.w[socket.id]) {
      delete socket.m.s.w[socket.id];
    }
    delete socket.m.sockets[socket.id];
    console.log(name, "left", roomName);
  });

  socket.on("move", (data) => {
    if (socket.m.s.m._.started) {
      if (socket.m.s.p[socket.id]) {
        socket.m.s.p[socket.id].go(data.dir, data.lock);
      }
    }
  });

  socket.on("shot", () => {
    if (socket.m.s.p[socket.id]) {
      socket.m.s.p[socket.id].shot();
    }
  });

  socket.on("jump", () => {
    if (socket.m.s.p[socket.id]) {
      socket.m.s.p[socket.id].jump();
    }
  });

  socket.on("switch", () => {
    if (socket.m.s.p[socket.id]) {
      socket.m.s.p[socket.id].switchTeam(socket.m);
    }
  });

  socket.on("roomlist", () => {
    const list = [{ room: "training" }];
    for (const r in rooms) {
      const p = rooms[r].countPlayers();
      if (p > 0 && r != "training") {
        list.push({ room: r, p, m: rooms[r].s.m._.maxp });
      }
    }
    socket.emit("rooms", list);
  });

  socket.on("msg", (data) => {
    if (socket.m.s.p[socket.id]) {
      data.user = socket.m.s.p[socket.id].name;
      data.team = socket.m.s.p[socket.id].team;
    } else if (socket.m.s.w[socket.id]) {
      data.user = socket.m.s.w[socket.id].name;
    } else {
      return;
    }
    console.log(socket.m.s.m._.name, "-", data.user, ":", data.text);
    data.text = cleanString(data.text);
    socket.m.broadcast("msg", data);
  });

  socket.on("ping", (cb) => {
    if (typeof cb === "function") {
      cb();
    }
  });

  console.log(name, "joined", roomName);
  socket.m.sockets[socket.id] = socket;
  socket.m.addPlayer(socket.id, name, cid, vehicle);
  socket.m.broadcast();
};

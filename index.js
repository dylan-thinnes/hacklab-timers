const express = require('express');
const http = require('http');
const socketio = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new socketio.Server(server);

let connections = new Set();

let timers = {};
function timer(name, timestamp) {
  if (timers[name] == null || timestamp != null) {
    timers[name] = timestamp;
    return true;
  }
  return false;
}

app.get('/', (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

app.get('/reset', (req, res) => {
  let name = req.query.name;
  if (name == null) {
    res.send("Reset must have a name.", 500);
    return;
  }

  let timestamp = req.query.timestamp;
  timestamp = parseFloat(timestamp);
  if (isNaN(timestamp)) timestamp = null;

  let changed = timer(name, timestamp);
  if (changed) {
    for (conn of connections) {
      console.log("Notifying timer data to", conn);
      conn.emit("update", timers);
    }

    res.send(`Timer with name ${name} successfully reset to ${timestamp}.`);
  } else {
    res.send(`Timer with name ${name} could not be reset to ${timestamp}.`, 400);
  }
});

io.on("connection", socket => {
  console.log(`New connection: ${socket}`);
  connections.add(socket);
  socket.on("close", () => {
    console.log(`Closing connection ${socket}`);
    connections.delete(socket);
  })
});

server.listen(3000, () => {
  console.log('listening on *:3000');
});

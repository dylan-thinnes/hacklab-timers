const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new socketio.Server(server);

let connections = new Set();

let timers = JSON.parse(fs.readFileSync("timers"));

function timer(name, timestamp) {
  let changed = false;
  if (timers[name] == null || timestamp != null) {
    timers[name] = timestamp;
    changed = true;
  }

  if (changed) {
    fs.writeFileSync("timers", JSON.stringify(timers));
  }

  return changed;
}

// Example timers:
//timer("Death of Jesus", -62135596725);
//timer("Nerd snipe", Date.now() / 1000);
//timer("Python GIL complaint", Date.now() / 1000);
//timer("Rust mention", Date.now() / 1000);
//timer("A monad is just a monoid in the category of endofunctors", Date.now() / 1000);

app.get('/', (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

app.get('/reset', (req, res) => {
  let name = req.query.name;
  if (name == null) {
    res.send("Reset must have a name.", 500);
    return;
  }

  let timestamp = req.query.time || req.query.timestamp;
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
  socket.emit("update", timers);
  socket.on("close", () => {
    console.log(`Closing connection ${socket}`);
    connections.delete(socket);
  })
});

server.listen(3000, () => {
  console.log('listening on *:3000');
});

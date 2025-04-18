import express from 'express';
import * as http from 'http';
import * as socketio from 'socket.io';
import * as fs from 'fs';

const app = express();
const server = http.createServer(app);
const io = new socketio.Server(server);

let connections = new Set();

let timers = JSON.parse(fs.readFileSync("timers"));

function resetTimer(name, rawTimestamp) {
  let timestamp = null;
  if (rawTimestamp == "now") {
    timestamp = Date.now() / 1000;
  } else if (rawTimestamp == "never") {
    timestamp = null;
  } else {
    timestamp = parseFloat(rawTimestamp);
    if (isNaN(timestamp)) return `Could not parse '${rawTimestamp}' as a float. Valid times are "now", "never", or a Unix timestamp.`
  }

  return { type: "set", "name": name, "value": timestamp };
}

function deleteTimer(name) {
  return { type: "delete", "name": name };
}

// Example timers:
//timer("Death of Jesus", -62135596725);
//timer("Nerd snipe", Date.now() / 1000);
//timer("Python GIL complaint", Date.now() / 1000);
//timer("Rewrite it in rust", Date.now() / 1000);
//timer("A monad is just a monoid in the category of endofunctors", Date.now() / 1000);

function edit(dict, delta) {
  if (delta.type == "delete") {
    delete dict[delta.name];
  } else if (delta.type == "set") {
    dict[delta.name] = delta.value;
  }
}

function applyDelta(res, delta) {
  if (typeof delta === "string") {
    res.send(`Error: ${errMsg}`, 400);
  } else {
    edit(timers, delta);
    fs.writeFileSync("timers", JSON.stringify(timers));

    for (let conn of connections) {
      //conn.emit("update", timers);
      conn.emit("edit", delta);
    }

    res.send(`Success.`);
  }
}

app.get('/delete', (req, res) => {
  let name = req.query.name;
  if (name == null) {
    res.send("Reset must have a name.", 500);
    return;
  }

  applyDelta(res, deleteTimer(name));
});

app.get('/reset', (req, res) => {
  let name = req.query.name;
  if (name == null) {
    res.send("Reset must have a name.", 500);
    return;
  }

  let rawTimestamp = req.query.time || req.query.timestamp;
  applyDelta(res, resetTimer(name, rawTimestamp));
});

io.on("connection", socket => {
  console.log(`New connection`, socket);
  connections.add(socket);
  socket.emit("update", timers);
  socket.on("close", () => {
    console.log(`Closing connection`, socket);
    connections.delete(socket);
  })
});

app.use(express.static("."))

server.listen(3456, () => {
  console.log('listening on *:3456');
});

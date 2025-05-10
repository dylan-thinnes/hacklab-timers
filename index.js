import express from 'express';
import * as http from 'http';
import * as socketio from 'socket.io';
import * as fs from 'fs';
import * as path from 'path';

const app = express();
const server = http.createServer(app);
const io = new socketio.Server(server);

const connections = new Set();

let timersDatabase = null;
console.log(process.argv);
if (process.argv.length < 3) {
  console.log("Must supply a filepath for timer database!")
  process.exit(1);
}
timersDatabase = path.resolve(process.argv[2]);

let eventLog = null;
console.log(process.argv);
if (process.argv.length < 4) {
  console.log("Must supply a filepath for delta logs!")
  process.exit(1);
}
eventLog = process.argv[3];

let timers = null;
try {
  timers = JSON.parse(fs.readFileSync(timersDatabase));
} catch (e) {
  console.log(`Couldn't read timers from ${timersDatabase}: ${e}`)
  timers = {};
}

const eventLogHandle = fs.openSync(eventLog, "a");
function logEvent(type, data) {
  let entry = { type: type, time: Date.now(), data }
  let raw = JSON.stringify(entry) + "\n"
  fs.appendFile(eventLogHandle, raw, { flush: true }, () => {});
}
logEvent("startup", timers);

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
    fs.writeFileSync(timersDatabase, JSON.stringify(timers));
    logEvent("delta", delta);

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

app.get('/history', (req, res) => {
  res.sendFile(path.resolve(eventLog));
  res.set('Content-Type', 'text/plain');
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

const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const fs = require('fs');

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

  timers[name] = timestamp;
  fs.writeFileSync("timers", JSON.stringify(timers));
}

function deleteTimer(name) {
  delete timers[name];
  fs.writeFileSync("timers", JSON.stringify(timers));
}

// Example timers:
//timer("Death of Jesus", -62135596725);
//timer("Nerd snipe", Date.now() / 1000);
//timer("Python GIL complaint", Date.now() / 1000);
//timer("Rewrite it in rust", Date.now() / 1000);
//timer("A monad is just a monoid in the category of endofunctors", Date.now() / 1000);

app.get('/', (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

app.get('/delete', (req, res) => {
  let name = req.query.name;
  if (name == null) {
    res.send("Reset must have a name.", 500);
    return;
  }

  deleteTimer(name);
  res.send(`Timer with name ${name} successfully deleted.`);

  for (conn of connections) {
    console.log("Notifying timer data to", conn);
    conn.emit("update", timers);
  }
});

app.get('/reset', (req, res) => {
  let name = req.query.name;
  if (name == null) {
    res.send("Reset must have a name.", 500);
    return;
  }

  let rawTimestamp = req.query.time || req.query.timestamp;
  let errMsg = resetTimer(name, rawTimestamp);

  if (errMsg == null) {
    res.send(`Timer with name ${name} successfully reset to '${rawTimestamp}'.`);

    for (conn of connections) {
      console.log("Notifying timer data to", conn);
      conn.emit("update", timers);
    }
  } else {
    res.send(`Timer with name ${name} could not be reset to '${rawTimestamp}' due to user error. Message: ${errMsg}`, 400);
  }
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

server.listen(3456, () => {
  console.log('listening on *:3456');
});

import networking from "./lib/networking.js";
import logging from "./lib/logging.js";
import server from "./lib/server.js";

process.on("uncaughtException", function(err) {
  logging.error("uncaughtException", err.stack || err.toString());
  process.exit(1);
});

setInterval(networking.resetCounter, 1000);

server.boot();
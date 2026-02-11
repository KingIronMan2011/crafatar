#!/usr/bin/env node
import response from "./response.js";
import helpers from "./helpers.js";
import toobusy from "toobusy-js";
import logging from "./logging.js";
import config from "../config.js";
import http from "http";
import mime from "mime";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let server = null;

const routes = {
  index: (await import("./routes/index.js")).default,
  avatars: (await import("./routes/avatars.js")).default,
  skins: (await import("./routes/skins.js")).default,
  renders: (await import("./routes/renders.js")).default,
  capes: (await import("./routes/capes.js")).default,
};

// serves assets from lib/public
function asset_request(req, callback) {
  const filename = path.join(__dirname, "public", ...req.url.path_list);
  const relative = path.relative(path.join(__dirname, "public"), filename);
  if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
    fs.access(filename, function (fs_err) {
      if (!fs_err) {
        fs.readFile(filename, function (err, data) {
          callback({
            body: data,
            type: mime.getType(filename),
            err: err,
          });
        });
      } else {
        callback({
          body: "Not found",
          status: -2,
          code: 404,
        });
      }
    });
  } else {
    callback({
      body: "Forbidden",
      status: -2,
      code: 403,
    });
  }
}

// generates a 12 character random string
function request_id() {
  return Math.random().toString(36).substring(2, 14);
}

// splits decoded URL path into an Array
function path_list(pathname) {
  var list = pathname.split("/");
  list.shift();
  return list;
}

// handles the +req+ by routing to the request to the appropriate module
function requestHandler(req, res) {
  req.url = new URL(decodeURI(req.url), "http://" + req.headers.host);
  // Normalize the pathname as a URL path (not a filesystem path)
  // This ensures cross-platform compatibility (Windows vs Unix)
  req.url.pathname = req.url.pathname.replace(/\\/g, "/").replace(/\/+/g, "/");
  if (!req.url.pathname.startsWith("/")) {
    req.url.pathname = "/" + req.url.pathname;
  }
  req.url.path_list = path_list(req.url.pathname);
  req.id = request_id();
  req.start = Date.now();

  const local_path = req.url.path_list[0];
  logging.debug(req.id, req.method, req.url.href);

  toobusy.maxLag(200);
  if (toobusy() && !process.env.TRAVIS) {
    response(req, res, {
      status: -1,
      body: "Server is over capacity :/",
      err: "Too busy",
      code: 503,
    });
    return;
  }

  if (req.method === "GET" || req.method === "HEAD") {
    try {
      switch (local_path) {
        case "":
          routes.index(req, function (result) {
            response(req, res, result);
          });
          break;
        case "avatars":
          routes.avatars(req, function (result) {
            response(req, res, result);
          });
          break;
        case "skins":
          routes.skins(req, function (result) {
            response(req, res, result);
          });
          break;
        case "renders":
          routes.renders(req, function (result) {
            response(req, res, result);
          });
          break;
        case "capes":
          routes.capes(req, function (result) {
            response(req, res, result);
          });
          break;
        default:
          asset_request(req, function (result) {
            response(req, res, result);
          });
      }
    } catch (e) {
      const error = JSON.stringify(req.headers) + "\n" + e.stack;
      response(req, res, {
        status: -1,
        body: config.server.debug_enabled ? error : "Internal Server Error",
        err: error,
      });
    }
  } else {
    response(req, res, {
      status: -2,
      body: "Method Not Allowed",
      code: 405,
    });
  }
}

const exp = {};

// Start the server
exp.boot = function (callback) {
  const port = config.server.port;
  const bind_ip = config.server.bind;
  server = http.createServer(requestHandler).listen(port, bind_ip, function () {
    logging.log("Server running on http://" + bind_ip + ":" + port + "/");
    if (callback) {
      callback();
    }
  });

  // stop accepting new connections,
  // wait for established connections to finish (30s max),
  // then exit
  process.on("SIGTERM", function () {
    logging.warn("Got SIGTERM, no longer accepting new connections!");

    setTimeout(function () {
      logging.error("Dropping connections after 30s. Force quit.");
      process.exit(1);
    }, 30000);

    server.close(function () {
      logging.log("All connections closed, shutting down.");
      process.exit();
    });
  });
};

// Close the server
exp.close = function (callback) {
  helpers.stoplog();
  server.close(callback);
};

export default exp;

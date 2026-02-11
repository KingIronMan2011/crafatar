import logging from "../logging.js";
import config from "../../config.js";
import path from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let html;

// load the index page
function load() {
  logging.log("Loading index page");
  html = readFileSync(
    path.join(__dirname, "..", "views", "index.html"),
    "utf-8",
  );
}

load();

// GET index request
export default function (req, callback) {
  if (config.server.debug_enabled) {
    // allow changes without reloading
    load();
  }
  callback({
    body: html,
    type: "text/html; charset=utf-8",
  });
}

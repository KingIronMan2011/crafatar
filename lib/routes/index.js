import logging from "../logging.js";
import config from "../../config.js";
import path from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";
import ejs from "ejs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let str;
let index;

// pre-compile the index page
function compile() {
  logging.log("Compiling index page");
  str = readFileSync(path.join(__dirname, "..", "views", "index.html.ejs"), "utf-8");
  index = ejs.compile(str);
}

compile();

// GET index request
export default function(req, callback) {
  if (config.server.debug_enabled) {
    // allow changes without reloading
    compile();
  }
  const html = index({
    title: "Crafatar",
    domain: "https://" + req.headers.host,
    config: config
  });
  callback({
    body: html,
    type: "text/html; charset=utf-8"
  });
}
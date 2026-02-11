import helpers from "../helpers.js";
import skins from "../skins.js";
import cache from "../cache.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// handle the appropriate 'default=' response
// uses either mhf_steve or mhf_alex (based on +userId+) if no +def+ given
// callback: response object
function handle_default(img_status, userId, def, req, err, callback) {
  def = def || skins.default_skin(userId);
  const defname = def.toLowerCase();
  if (defname !== "steve" && defname !== "mhf_steve" && defname !== "alex" && defname !== "mhf_alex") {
    if (helpers.id_valid(def)) {
      // clean up the old URL to match new image
      req.url.searchParams.delete('default');
      req.url.path_list[1] = def;
      req.url.pathname = req.url.path_list.join('/');
      const newUrl = req.url.toString();
      callback({
        status: img_status,
        redirect: newUrl,
        err: err
      });
    } else {
      callback({
        status: img_status,
        redirect: def,
        err: err
      });
    }
  } else {
    // handle steve and alex
    def = defname;
    if (def.substr(0, 4) !== "mhf_") {
      def = "mhf_" + def;
    }
    skins.open_skin(req.id, path.join(__dirname, "..", "public", "images", def + "_skin.png"), function(skin_err, buffer) {
      callback({
        status: img_status,
        body: buffer,
        type: "image/png",
        hash: def,
        err: skin_err || err
      });
    });
  }
}

// GET skin request
export default function(req, callback) {
  const userId = (req.url.path_list[1] || "").split(".")[0];
  const def = req.url.searchParams.get("default");
  const rid = req.id;

  // check for extra paths
  if (req.url.path_list.length > 2) {
    callback({
      status: -2,
      body: "Invalid Path",
      code: 404
    });
    return;
  }

  // strip dashes
  userId = userId.replace(/-/g, "");
  if (!helpers.id_valid(userId)) {
    callback({
      status: -2,
      body: "Invalid UUID"
    });
    return;
  }

  try {
    helpers.get_skin(rid, userId, function(err, hash, status, image, slim) {
      if (err) {
        if (err.code === "ENOENT") {
          // no such file
          cache.remove_hash(req.id, userId);
        }
      }
      if (image) {
        callback({
          status: status,
          body: image,
          type: "image/png",
          hash: hash,
          err: err
        });
      } else {
        handle_default(2, userId, def, req, err, callback);
      }
    });
  } catch(e) {
    handle_default(-1, userId, def, req, e, callback);
  }
}
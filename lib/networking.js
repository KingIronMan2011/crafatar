import logging from "./logging.js";
import axios from "axios";
import config from "../config.js";
import skins from "./skins.js";
import http from "http";
import "./object-patch.js";

const session_url =
  "https://sessionserver.mojang.com/session/minecraft/profile/";
const textures_url = "https://textures.minecraft.net/texture/";

// count requests made to session_url in the last 1000ms
let session_requests = [];

const exp = {};

// returns the amount of outgoing session requests made in the last 1000ms
function req_count() {
  const index = session_requests.findIndex((i) => i >= Date.now() - 1000);
  if (index >= 0) {
    return session_requests.length - index;
  } else {
    return 0;
  }
}

// deletes all entries in session_requests, should be called every 1000ms
exp.resetCounter = function () {
  const count = req_count();
  if (count) {
    const logfunc =
      count >= config.server.sessions_rate_limit ? logging.warn : logging.debug;
    logfunc("Clearing old session requests (count was " + count + ")");
    session_requests.splice(0, session_requests.length - count);
  } else {
    session_requests = [];
  }
};

// performs a GET request to the +url+
// +options+ object includes these options:
//   encoding (string), default is to return a buffer
// callback: the body, response,
// and error buffer. get_from helper method is available
exp.get_from_options = function (rid, url, options, callback) {
  const is_session_req =
    config.server.sessions_rate_limit && url.startsWith(session_url);

  // This is to prevent being blocked by CloudFront for exceeding the rate limit
  if (is_session_req && req_count() >= config.server.sessions_rate_limit) {
    const e = new Error("Skipped, rate limit exceeded");
    e.name = "HTTP";
    e.code = "RATELIMIT";

    const response = new http.IncomingMessage();
    response.statusCode = 403;

    callback(null, response, e);
  } else {
    is_session_req && session_requests.push(Date.now());

    axios
      .get(url, {
        headers: {
          "User-Agent": "Crafatar (+https://crafatar.com)",
        },
        timeout: config.server.http_timeout,
        maxRedirects: 0,
        responseType: options.encoding === "utf8" ? "text" : "arraybuffer",
        validateStatus: () => true, // Accept all status codes
      })
      .then(function (axiosResponse) {
        const code = axiosResponse.status;
        const body =
          options.encoding === "utf8"
            ? axiosResponse.data
            : Buffer.from(axiosResponse.data);

        // Create a response object similar to the old request library
        const response = {
          statusCode: code,
          headers: axiosResponse.headers,
        };

        const logfunc =
          code && (code < 400 || code === 404) ? logging.debug : logging.warn;
        logfunc(rid, url, code, http.STATUS_CODES[code]);

        // not necessarily used
        const e = new Error(code);
        e.name = "HTTP";
        e.code = "HTTPERROR";

        let finalBody = body;
        let error = null;

        switch (code) {
          case 200:
          case 301:
          case 302: // never seen, but mojang might use it in future
          case 307: // never seen, but mojang might use it in future
          case 308: // never seen, but mojang might use it in future
            // these are okay
            break;
          case 204: // no content, used like 404 by mojang. making sure it really has no content
          case 404:
            // can be cached as null
            finalBody = null;
            break;
          case 403: // Blocked by CloudFront :(
          case 429: // this shouldn't usually happen, but occasionally does
          case 500:
          case 502: // CloudFront can't reach mojang origin
          case 503:
          case 504:
            // we don't want to cache this
            error = e;
            finalBody = null;
            break;
          default:
            // Probably 500 or the likes
            logging.error(rid, "Unexpected response:", code, body);
            error = e;
            finalBody = null;
            break;
        }

        if (finalBody && !finalBody.length) {
          // empty response
          finalBody = null;
        }

        callback(finalBody, response, error);
      })
      .catch(function (axiosError) {
        const code = axiosError.response?.status;
        let normalizedErrorCode = axiosError.code;

        // Normalize axios timeout errors to legacy timeout codes expected elsewhere
        if (
          normalizedErrorCode === "ECONNABORTED" &&
          typeof axiosError.message === "string"
        ) {
          const msg = axiosError.message.toLowerCase();
          if (msg.includes("timeout")) {
            normalizedErrorCode = "ETIMEDOUT";
          }
        }

        const logfunc =
          code && (code < 400 || code === 404) ? logging.debug : logging.warn;
        logfunc(rid, url, normalizedErrorCode || code, http.STATUS_CODES[code]);

        const e = new Error(axiosError.message);
        e.name = axiosError.name;
        e.code = normalizedErrorCode || "HTTPERROR";

        const response = axiosError.response
          ? {
              statusCode: axiosError.response.status,
              headers: axiosError.response.headers,
            }
          : null;

        callback(null, response, e);
      });
  }
};

// helper method for get_from_options, no options required
exp.get_from = function (rid, url, callback) {
  exp.get_from_options(rid, url, {}, function (body, response, err) {
    callback(body, response, err);
  });
};

// gets the URL for a skin/cape from the profile
// +type+ "SKIN" or "CAPE", specifies which to retrieve
// callback: url, slim
exp.get_uuid_info = function (profile, type, callback) {
  const properties = Object.get(profile, "properties") || [];
  properties.forEach(function (prop) {
    if (prop.name === "textures") {
      const json = Buffer.from(prop.value, "base64").toString();
      profile = JSON.parse(json);
    }
  });

  const url = Object.get(profile, "textures." + type + ".url");
  let slim;
  if (type === "SKIN") {
    slim = Object.get(profile, "textures.SKIN.metadata.model") === "slim";
  }

  callback(null, url || null, !!slim);
};

// make a request to sessionserver for +uuid+
// callback: error, profile
exp.get_profile = function (rid, uuid, callback) {
  exp.get_from_options(
    rid,
    session_url + uuid,
    { encoding: "utf8" },
    function (body, response, err) {
      try {
        body = body ? JSON.parse(body) : null;
        callback(err || null, body);
      } catch (e) {
        if (e instanceof SyntaxError) {
          logging.warn(rid, "Failed to parse JSON", e);
          logging.debug(rid, body);
          callback(err || null, null);
        } else {
          throw e;
        }
      }
    },
  );
};

// get the skin URL and type for +userId+
// +profile+ is used if +userId+ is a uuid
// callback: error, url, slim
exp.get_skin_info = function (rid, userId, profile, callback) {
  exp.get_uuid_info(profile, "SKIN", callback);
};

// get the cape URL for +userId+
// +profile+ is used if +userId+ is a uuid
exp.get_cape_url = function (rid, userId, profile, callback) {
  exp.get_uuid_info(profile, "CAPE", callback);
};

// download the +tex_hash+ image from the texture server
// and save it in the +outpath+ file
// callback: error, response, image buffer
exp.save_texture = function (rid, tex_hash, outpath, callback) {
  if (tex_hash) {
    const textureurl = textures_url + tex_hash;
    exp.get_from(rid, textureurl, function (img, response, err) {
      if (err) {
        callback(err, response, null);
      } else {
        skins.save_image(img, outpath, function (img_err) {
          callback(img_err, response, img);
        });
      }
    });
  } else {
    callback(null, null, null);
  }
};

export default exp;

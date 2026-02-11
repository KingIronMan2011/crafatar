/* eslint no-loop-func:0 guard-for-in:0 */

// no spam
import logging from "../lib/logging.js";
if (process.env.VERBOSE_TEST !== "true") {
  logging.log = logging.debug = logging.warn = logging.error = function () {};
}

import networking from "../lib/networking.js";
import helpers from "../lib/helpers.js";
import axios from "axios";
import config from "../config.js";
import server from "../lib/server.js";
import assert from "assert";
import skins from "../lib/skins.js";
import cache from "../lib/cache.js";
import { crc32 as crc } from "crc";
import fs from "fs";

// we don't want tests to fail because of slow internet
config.server.http_timeout *= 3;

const uuids = fs.readFileSync("test/uuids.txt").toString().split(/\r?\n/);

// Get a random UUIDto prevent rate limiting
const uuid = uuids[Math.round(Math.random() * (uuids.length - 1))];

// Let's hope these will never be assigned
const steve_ids = [
  "fffffff0" + "fffffff0" + "fffffff0" + "fffffff0",
  "fffffff0" + "fffffff0" + "fffffff1" + "fffffff1",
  "fffffff0" + "fffffff1" + "fffffff0" + "fffffff1",
  "fffffff0" + "fffffff1" + "fffffff1" + "fffffff0",
  "fffffff1" + "fffffff0" + "fffffff0" + "fffffff1",
  "fffffff1" + "fffffff0" + "fffffff1" + "fffffff0",
  "fffffff1" + "fffffff1" + "fffffff0" + "fffffff0",
  "fffffff1" + "fffffff1" + "fffffff1" + "fffffff1",
];
// Let's hope these will never be assigned
const alex_ids = [
  "fffffff0" + "fffffff0" + "fffffff0" + "fffffff1",
  "fffffff0" + "fffffff0" + "fffffff1" + "fffffff0",
  "fffffff0" + "fffffff1" + "fffffff0" + "fffffff0",
  "fffffff0" + "fffffff1" + "fffffff1" + "fffffff1",
  "fffffff1" + "fffffff0" + "fffffff0" + "fffffff0",
  "fffffff1" + "fffffff0" + "fffffff1" + "fffffff1",
  "fffffff1" + "fffffff1" + "fffffff0" + "fffffff1",
  "fffffff1" + "fffffff1" + "fffffff1" + "fffffff0",
];

// generates a 12 character random string
function rid() {
  return Math.random().toString(36).substring(2, 14);
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

describe("Crafatar", function () {
  before(async function () {
    console.log("Flushing and waiting for redis ...");
    await cache.get_redis().flushAll();
    console.log("Redis flushed!");
  });

  describe("UUID/username", function () {
    it("non-hex uuid is invalid", function (done) {
      assert.strictEqual(
        helpers.id_valid("g098cb60fa8e427cb299793cbd302c9a"),
        false,
      );
      done();
    });
    it("empty id is invalid", function (done) {
      assert.strictEqual(helpers.id_valid(""), false);
      done();
    });
    it("lowercase uuid is valid", function (done) {
      assert.strictEqual(
        helpers.id_valid("0098cb60fa8e427cb299793cbd302c9a"),
        true,
      );
      done();
    });
    it("uppercase uuid is valid", function (done) {
      assert.strictEqual(
        helpers.id_valid("1DCEF164FF0A47F2B9A691385C774EE7"),
        true,
      );
      done();
    });
    it("dashed uuid is not valid", function (done) {
      assert.strictEqual(
        helpers.id_valid("0098cb60-fa8e-427c-b299-793cbd302c9a"),
        false,
      );
      done();
    });
    it("username is invalid", function (done) {
      assert.strictEqual(helpers.id_valid("__niceUs3rname__"), false);
      done();
    });
    it("username alex is invalid", function (done) {
      assert.strictEqual(helpers.id_valid("alex"), false);
      done();
    });
    it("username mhf_alex is invalid", function (done) {
      assert.strictEqual(helpers.id_valid("mhf_alex"), false);
      done();
    });
    it("username steve is invalid", function (done) {
      assert.strictEqual(helpers.id_valid("steve"), false);
      done();
    });
    it("username mhf_steve is invalid", function (done) {
      assert.strictEqual(helpers.id_valid("mhf_steve"), false);
      done();
    });
    it(">16 length username is invalid", function (done) {
      assert.strictEqual(helpers.id_valid("ThisNameIsTooLong"), false);
      done();
    });
    it("should not exist (uuid)", function (done) {
      const number = getRandomInt(0, 9).toString();
      networking.get_profile(
        rid(),
        Array(33).join(number),
        function (err, profile) {
          assert.ifError(err);
          assert.strictEqual(profile, null);
          done();
        },
      );
    });
  });
  describe("Avatar", function () {
    for (const a in alex_ids) {
      const alexid = alex_ids[a];
      (function (alex_id) {
        it("UUID " + alex_id + " should default to MHF_Alex", function (done) {
          assert.strictEqual(skins.default_skin(alex_id), "mhf_alex");
          done();
        });
      })(alexid);
    }
    for (const s in steve_ids) {
      const steveid = steve_ids[s];
      (function (steve_id) {
        it(
          "UUID " + steve_id + " should default to MHF_Steve",
          function (done) {
            assert.strictEqual(skins.default_skin(steve_id), "mhf_steve");
            done();
          },
        );
      })(steveid);
    }
  });
  describe("Errors", function () {
    it("should time out on uuid info download", function (done) {
      const original_timeout = config.server.http_timeout;
      config.server.http_timeout = 1;
      networking.get_profile(
        rid(),
        "069a79f444e94726a5befca90e38aaf5",
        function (err) {
          assert.notStrictEqual(
            ["ETIMEDOUT", "ESOCKETTIMEDOUT"].indexOf(err.code),
            -1,
          );
          config.server.http_timeout = original_timeout;
          done();
        },
      );
    });
    it("should time out on skin download", function (done) {
      const original_timeout = config.server.http_timeout;
      config.server.http_timeout = 1;
      networking.get_from(
        rid(),
        "http://textures.minecraft.net/texture/477be35554684c28bdeee4cf11c591d3c88afb77e0b98da893fd7bc318c65184",
        function (body, res, error) {
          assert.notStrictEqual(
            ["ETIMEDOUT", "ESOCKETTIMEDOUT"].indexOf(error.code),
            -1,
          );
          config.server.http_timeout = original_timeout;
          done();
        },
      );
    });
    it("should not find the skin", function (done) {
      assert.doesNotThrow(function () {
        networking.get_from(
          rid(),
          "http://textures.minecraft.net/texture/this-does-not-exist",
          function (img, response, err) {
            assert.strictEqual(err, null); // no error here, but it shouldn't throw exceptions
            done();
          },
        );
      });
    });
    it("should not find the file", function (done) {
      skins.open_skin(rid(), "non/existent/path", function (err) {
        assert(err);
        done();
      });
    });
  });

  describe("Server", function () {
    // throws Exception when default headers are not in res.headers
    function assert_headers(res) {
      assert(res.headers["content-type"]);
      assert("" + res.headers["response-time"]);
      assert(res.headers["x-request-id"]);
      assert.equal(res.headers["access-control-allow-origin"], "*");
      assert.equal(
        res.headers["cache-control"],
        "max-age=" + config.caching.browser,
      );
    }

    // throws Exception when +url+ is requested with +etag+
    // and it does not return 304 without a body
    async function assert_cache(url, etag, callback) {
      try {
        const res = await axios.get(url, {
          headers: {
            "If-None-Match": etag,
          },
          validateStatus: () => true,
        });
        assert.strictEqual(res.data, "");
        assert.equal(res.status, 304);
        assert_headers(res);
        callback();
      } catch (error) {
        callback(error);
      }
    }

    before(function (done) {
      server.boot(function () {
        done();
      });
    });

    it("should return 405 Method Not Allowed for POST", async function () {
      const res = await axios.post(
        "http://localhost:3000",
        {},
        { validateStatus: () => true },
      );
      assert.strictEqual(res.status, 405);
    });

    it("should return correct HTTP response for home page", async function () {
      const url = "http://localhost:3000";
      const res = await axios.get(url, { validateStatus: () => true });
      assert.strictEqual(res.status, 200);
      assert_headers(res);
      assert(res.headers.etag);
      assert.strictEqual(
        res.headers["content-type"],
        "text/html; charset=utf-8",
      );
      assert.strictEqual(res.headers.etag, '"' + crc(res.data) + '"');
      assert(res.data);

      await new Promise((resolve, reject) => {
        assert_cache(url, res.headers.etag, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });

    it("should return correct HTTP response for assets", async function () {
      const url = "http://localhost:3000/stylesheets/style.css";
      const res = await axios.get(url, { validateStatus: () => true });
      assert.strictEqual(res.status, 200);
      assert_headers(res);
      assert(res.headers.etag);
      assert.strictEqual(res.headers["content-type"], "text/css");
      assert.strictEqual(res.headers.etag, '"' + crc(res.data) + '"');
      assert(res.data);

      await new Promise((resolve, reject) => {
        assert_cache(url, res.headers.etag, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });

    it("should return correct HTTP response for URL encoded URLs", async function () {
      const url =
        "http://localhost:3000/%61%76%61%74%61%72%73/%61%65%37%39%35%61%61%38%36%33%32%37%34%30%38%65%39%32%61%62%32%35%63%38%61%35%39%66%33%62%61%31"; // avatars/ae795aa86327408e92ab25c8a59f3ba1
      const res = await axios.get(url, { validateStatus: () => true });
      assert.strictEqual(res.status, 200);
      assert_headers(res);
      assert(res.headers.etag);
      assert.strictEqual(res.headers["content-type"], "image/png");
      assert(res.data);
    });

    it("should not fail on simultaneous requests", async function () {
      const url =
        "http://localhost:3000/avatars/696a82ce41f44b51aa31b8709b8686f0";
      // 10 requests at once
      const requests = 10;
      const promises = [];
      for (let k = 0; k < requests; k++) {
        promises.push(
          axios.get(url, { validateStatus: () => true }).then((res) => {
            assert.strictEqual(res.status, 200);
            assert_headers(res);
            assert(res.headers.etag);
            assert.strictEqual(res.headers["content-type"], "image/png");
            assert(res.data);
          }),
        );
      }
      await Promise.all(promises);
    });

    const server_tests = {
      "avatar with existing uuid": {
        url: "http://localhost:3000/avatars/853c80ef3c3749fdaa49938b674adae6?size=16",
        crc32: [4264176600],
      },
      "avatar with existing dashed uuid": {
        url: "http://localhost:3000/avatars/853c80ef-3c37-49fd-aa49938b674adae6?size=16",
        crc32: [4264176600],
      },
      "avatar with non-existent uuid": {
        url: "http://localhost:3000/avatars/00000000000000000000000000000000?size=16",
        crc32: [3348154329],
      },
      "avatar with non-existent uuid defaulting to mhf_alex": {
        url: "http://localhost:3000/avatars/00000000000000000000000000000000?size=16&default=mhf_alex",
        crc32: [73899130],
      },
      "avatar with non-existent uuid defaulting to uuid": {
        url: "http://localhost:3000/avatars/00000000000000000000000000000000?size=16&default=853c80ef3c3749fdaa49938b674adae6",
        crc32: [0],
        redirect:
          "http://localhost:3000/avatars/853c80ef3c3749fdaa49938b674adae6?size=16",
      },
      "avatar with non-existent uuid defaulting to url": {
        url: "http://localhost:3000/avatars/00000000000000000000000000000000?size=16&default=http%3A%2F%2Fexample.com%2FCaseSensitive",
        crc32: [0],
        redirect: "http://example.com/CaseSensitive",
      },
      "overlay avatar with existing uuid": {
        url: "http://localhost:3000/avatars/853c80ef3c3749fdaa49938b674adae6?size=16&overlay",
        crc32: [575355728],
      },
      "overlay avatar with non-existent uuid": {
        url: "http://localhost:3000/avatars/00000000000000000000000000000000?size=16&overlay",
        crc32: [3348154329],
      },
      "overlay avatar with non-existent uuid defaulting to mhf_alex": {
        url: "http://localhost:3000/avatars/00000000000000000000000000000000?size=16&overlay&default=mhf_alex",
        crc32: [73899130],
      },
      "overlay avatar with non-existent uuid defaulting to uuid": {
        url: "http://localhost:3000/avatars/00000000000000000000000000000000?size=16&default=853c80ef3c3749fdaa49938b674adae6",
        crc32: [0],
        redirect:
          "http://localhost:3000/avatars/853c80ef3c3749fdaa49938b674adae6?size=16",
      },
      "overlay avatar with non-existent uuid defaulting to url": {
        url: "http://localhost:3000/avatars/00000000000000000000000000000000?size=16&overlay&default=http%3A%2F%2Fexample.com%2FCaseSensitive",
        crc32: [0],
        redirect: "http://example.com/CaseSensitive",
      },
      "cape with existing uuid": {
        url: "http://localhost:3000/capes/853c80ef3c3749fdaa49938b674adae6",
        crc32: [985789174, 2099310578],
      },
      "cape with non-existent uuid": {
        url: "http://localhost:3000/capes/00000000000000000000000000000000",
        crc32: [0],
      },
      "cape with non-existent uuid defaulting to url": {
        url: "http://localhost:3000/capes/00000000000000000000000000000000?default=http%3A%2F%2Fexample.com%2FCaseSensitive",
        crc32: [0],
        redirect: "http://example.com/CaseSensitive",
      },
      "skin with existing uuid": {
        url: "http://localhost:3000/skins/853c80ef3c3749fdaa49938b674adae6",
        crc32: [1759176487],
      },
      "skin with non-existent uuid": {
        url: "http://localhost:3000/skins/00000000000000000000000000000000",
        crc32: [1853029228],
      },
      "skin with non-existent uuid defaulting to mhf_alex": {
        url: "http://localhost:3000/skins/00000000000000000000000000000000?default=mhf_alex",
        crc32: [427506205],
      },
      "skin with non-existent uuid defaulting to uuid": {
        url: "http://localhost:3000/skins/00000000000000000000000000000000?size=16&default=853c80ef3c3749fdaa49938b674adae6",
        crc32: [0],
        redirect:
          "http://localhost:3000/skins/853c80ef3c3749fdaa49938b674adae6?size=16",
      },
      "skin with non-existent uuid defaulting to url": {
        url: "http://localhost:3000/skins/00000000000000000000000000000000?default=http%3A%2F%2Fexample.com%2FCaseSensitive",
        crc32: [0],
        redirect: "http://example.com/CaseSensitive",
      },
      "head render with existing uuid": {
        url: "http://localhost:3000/renders/head/853c80ef3c3749fdaa49938b674adae6?scale=2",
        crc32: [1168786201],
      },
      "head render with non-existent uuid": {
        url: "http://localhost:3000/renders/head/00000000000000000000000000000000?scale=2",
        crc32: [3800926063],
      },
      "head render with non-existent uuid defaulting to mhf_alex": {
        url: "http://localhost:3000/renders/head/00000000000000000000000000000000?scale=2&default=mhf_alex",
        crc32: [4027858557],
      },
      "head render with non-existent uuid defaulting to uuid": {
        url: "http://localhost:3000/renders/head/00000000000000000000000000000000?scale=2&default=853c80ef3c3749fdaa49938b674adae6",
        crc32: [0],
        redirect:
          "http://localhost:3000/renders/head/853c80ef3c3749fdaa49938b674adae6?scale=2",
      },
      "head render with non-existent uuid defaulting to url": {
        url: "http://localhost:3000/renders/head/00000000000000000000000000000000?scale=2&default=http%3A%2F%2Fexample.com%2FCaseSensitive",
        crc32: [0],
        redirect: "http://example.com/CaseSensitive",
      },
      "overlay head render with existing uuid": {
        url: "http://localhost:3000/renders/head/853c80ef3c3749fdaa49938b674adae6?scale=2&overlay",
        crc32: [2880579826],
      },
      "overlay head render with non-existent uuid": {
        url: "http://localhost:3000/renders/head/00000000000000000000000000000000?scale=2&overlay",
        crc32: [3800926063],
      },
      "overlay head render with non-existent uuid defaulting to mhf_alex": {
        url: "http://localhost:3000/renders/head/00000000000000000000000000000000?scale=2&overlay&default=mhf_alex",
        crc32: [4027858557],
      },
      "overlay head with non-existent uuid defaulting to uuid": {
        url: "http://localhost:3000/renders/head/00000000000000000000000000000000?scale=2&overlay&default=853c80ef3c3749fdaa49938b674adae6",
        crc32: [0],
        redirect:
          "http://localhost:3000/renders/head/853c80ef3c3749fdaa49938b674adae6?scale=2&overlay=",
      },
      "overlay head render with non-existent uuid defaulting to url": {
        url: "http://localhost:3000/renders/head/00000000000000000000000000000000?scale=2&overlay&default=http%3A%2F%2Fexample.com%2FCaseSensitive",
        crc32: [0],
        redirect: "http://example.com/CaseSensitive",
      },
      "body render with existing uuid": {
        url: "http://localhost:3000/renders/body/853c80ef3c3749fdaa49938b674adae6?scale=2",
        crc32: [1144887125],
      },
      "body render with non-existent uuid": {
        url: "http://localhost:3000/renders/body/00000000000000000000000000000000?scale=2",
        crc32: [996962526],
      },
      "body render with non-existent uuid defaulting to mhf_alex": {
        url: "http://localhost:3000/renders/body/00000000000000000000000000000000?scale=2&default=mhf_alex",
        crc32: [4280894468],
      },
      "body render with non-existent uuid defaulting to uuid": {
        url: "http://localhost:3000/renders/body/00000000000000000000000000000000?scale=2&default=853c80ef3c3749fdaa49938b674adae6",
        crc32: [0],
        redirect:
          "http://localhost:3000/renders/body/853c80ef3c3749fdaa49938b674adae6?scale=2",
      },
      "body render with non-existent uuid defaulting to url": {
        url: "http://localhost:3000/renders/body/00000000000000000000000000000000?scale=2&default=http%3A%2F%2Fexample.com%2FCaseSensitive",
        crc32: [0],
        redirect: "http://example.com/CaseSensitive",
      },
      "overlay body render with existing uuid": {
        url: "http://localhost:3000/renders/body/853c80ef3c3749fdaa49938b674adae6?scale=2&overlay",
        crc32: [1107696668],
      },
      "overlay body render with non-existent uuid": {
        url: "http://localhost:3000/renders/body/00000000000000000000000000000000?scale=2&overlay",
        crc32: [996962526],
      },
      "overlay body render with non-existent uuid defaulting to mhf_alex": {
        url: "http://localhost:3000/renders/body/00000000000000000000000000000000?scale=2&overlay&default=mhf_alex",
        crc32: [4280894468],
      },
      "overlay body render with non-existent uuid defaulting to url": {
        url: "http://localhost:3000/renders/body/00000000000000000000000000000000?scale=2&overlay&default=http%3A%2F%2Fexample.com%2FCaseSensitive",
        crc32: [0],
        redirect: "http://example.com/CaseSensitive",
      },
    };

    for (const description in server_tests) {
      const loc = server_tests[description];
      (function (location) {
        it(
          "should return correct HTTP response for " + description,
          async function () {
            const res = await axios.get(location.url, {
              maxRedirects: 0,
              validateStatus: () => true,
              responseType: "arraybuffer",
            });
            assert_headers(res);
            assert(res.headers["x-storage-type"]);
            const body = Buffer.from(res.data);
            const hash = crc(body);
            let matches = false;
            for (let c = 0; c < location.crc32.length; c++) {
              if (location.crc32[c] === hash) {
                matches = true;
                break;
              }
            }
            try {
              assert(matches);
            } catch {
              throw new Error(
                hash +
                  " != " +
                  location.crc32 +
                  " | " +
                  body.toString("base64"),
              );
            }
            assert.strictEqual(res.headers.location, location.redirect);
            if (location.crc32[0] === 0) {
              assert.strictEqual(res.status, location.redirect ? 307 : 404);
              assert.ifError(res.headers.etag); // etag must not be present on non-200
              assert.strictEqual(res.headers["content-type"], "text/plain");
            } else {
              assert.strictEqual(res.headers["content-type"], "image/png");
              assert.strictEqual(res.status, 200);
              assert(res.headers.etag);
              assert.strictEqual(res.headers.etag, '"' + hash + '"');
              await new Promise((resolve, reject) => {
                assert_cache(location.url, res.headers.etag, (err) => {
                  if (err) reject(err);
                  else resolve();
                });
              });
            }
          },
        );
      })(loc);
    }

    it("should return 304 on server error", async function () {
      const original_debug = config.server.debug_enabled;
      const original_timeout = config.server.http_timeout;
      config.server.debug_enabled = false;
      config.server.http_timeout = 1;
      const res = await axios.get(
        "http://localhost:3000/avatars/0000000000000000000000000000000f",
        {
          headers: { "If-None-Match": '"some-etag"' },
          validateStatus: () => true,
        },
      );
      assert.strictEqual(res.data, "");
      assert.strictEqual(res.status, 304);
      config.server.debug_enabled = original_debug;
      config.server.http_timeout = original_timeout;
    });

    it("should return a 422 (invalid size)", async function () {
      const size = config.avatars.max_size + 1;
      const res = await axios.get(
        "http://localhost:3000/avatars/2d5aa9cdaeb049189930461fc9b91cc5?size=" +
          size,
        {
          validateStatus: () => true,
        },
      );
      assert.strictEqual(res.status, 422);
    });

    it("should return a 422 (invalid scale)", async function () {
      const scale = config.renders.max_scale + 1;
      const res = await axios.get(
        "http://localhost:3000/renders/head/2d5aa9cdaeb049189930461fc9b91cc5?scale=" +
          scale,
        {
          validateStatus: () => true,
        },
      );
      assert.strictEqual(res.status, 422);
    });

    it("should return a 422 (invalid render type)", async function () {
      const res = await axios.get(
        "http://localhost:3000/renders/invalid/2d5aa9cdaeb049189930461fc9b91cc5",
        {
          validateStatus: () => true,
        },
      );
      assert.strictEqual(res.status, 422);
    });

    // testing all paths for Invalid UUID
    const locations = [
      "avatars",
      "skins",
      "capes",
      "renders/body",
      "renders/head",
    ];
    for (const l in locations) {
      const locationPath = locations[l];
      (function (locationPath) {
        it(
          "should return a 422 (invalid uuid " + locationPath + ")",
          async function () {
            const res = await axios.get(
              "http://localhost:3000/" + locationPath + "/thisisaninvaliduuid",
              {
                validateStatus: () => true,
              },
            );
            assert.strictEqual(res.status, 422);
          },
        );

        it(
          "should return a 404 (invalid path " + locationPath + ")",
          async function () {
            const res = await axios.get(
              "http://localhost:3000/" +
                locationPath +
                "/853c80ef3c3749fdaa49938b674adae6/invalid",
              {
                validateStatus: () => true,
              },
            );
            assert.strictEqual(res.status, 404);
          },
        );
      })(locationPath);
    }

    it("should return /public resources", async function () {
      const res = await axios.get(
        "http://localhost:3000/javascript/crafatar.js",
        {
          validateStatus: () => true,
        },
      );
      assert.strictEqual(res.status, 200);
    });

    it("should not allow path traversal on /public", async function () {
      const res = await axios.get("http://localhost:3000/../server.js", {
        validateStatus: () => true,
      });
      assert.strictEqual(res.status, 404);
    });

    it("should not allow encoded path traversal on /public", async function () {
      const res = await axios.get("http://localhost:3000/%2E%2E/server.js", {
        validateStatus: () => true,
      });
      assert.strictEqual(res.status, 404);
    });
  });

  // we have to make sure that we test both a 32x64 and 64x64 skin
  describe("Networking: Render", function () {
    it("should not fail (uuid, 32x64 skin)", function (done) {
      helpers.get_render(
        rid(),
        "af74a02d19cb445bb07f6866a861f783",
        6,
        true,
        true,
        function (err) {
          assert.strictEqual(err, null);
          done();
        },
      );
    });
    it("should not fail (uuid, 64x64 skin)", function (done) {
      helpers.get_render(
        rid(),
        "2d5aa9cdaeb049189930461fc9b91cc5",
        6,
        true,
        true,
        function (err) {
          assert.strictEqual(err, null);
          done();
        },
      );
    });
  });

  describe("Networking: Cape", function () {
    it("should not fail (guaranteed cape)", function (done) {
      helpers.get_cape(
        rid(),
        "61699b2ed3274a019f1e0ea8c3f06bc6",
        function (err) {
          assert.strictEqual(err, null);
          done();
        },
      );
    });
    it("should already exist", function (done) {
      before(async function () {
        await cache.get_redis().flushAll();
      });
      helpers.get_cape(
        rid(),
        "61699b2ed3274a019f1e0ea8c3f06bc6",
        function (err) {
          assert.strictEqual(err, null);
          done();
        },
      );
    });
    it("should not be found", function (done) {
      helpers.get_cape(
        rid(),
        "2d5aa9cdaeb049189930461fc9b91cc5",
        function (err, img) {
          assert.ifError(err);
          assert.strictEqual(img, null);
          done();
        },
      );
    });
  });

  describe("Networking: Skin", function () {
    it("should not fail", function (done) {
      helpers.get_cape(
        rid(),
        "2d5aa9cdaeb049189930461fc9b91cc5",
        function (err) {
          assert.strictEqual(err, null);
          done();
        },
      );
    });
    it("should already exist", function (done) {
      before(async function () {
        await cache.get_redis().flushAll();
      });
      helpers.get_cape(
        rid(),
        "2d5aa9cdaeb049189930461fc9b91cc5",
        function (err) {
          assert.strictEqual(err, null);
          done();
        },
      );
    });
  });

  describe("Networking: Avatar", function () {
    before(async function () {
      await cache.get_redis().flushAll();
    });
    it("should be downloaded", function (done) {
      helpers.get_avatar(rid(), uuid, false, 160, function (err, status) {
        assert.ifError(err);
        assert.strictEqual(status, 2);
        done();
      });
    });
    it("should be cached", function (done) {
      helpers.get_avatar(rid(), uuid, false, 160, function (err, status) {
        assert.ifError(err);
        assert.strictEqual(status === 0 || status === 1, true);
        done();
      });
    });
  });

  describe("Networking: Skin", function () {
    it("should not fail (uuid)", function (done) {
      helpers.get_skin(rid(), uuid, function (err) {
        assert.strictEqual(err, null);
        done();
      });
    });
  });

  describe("Networking: Render", function () {
    it("should not fail (full body)", function (done) {
      helpers.get_render(rid(), uuid, 6, true, true, function (err) {
        assert.ifError(err);
        done();
      });
    });
    it("should not fail (only head)", function (done) {
      helpers.get_render(rid(), uuid, 6, true, false, function (err) {
        assert.ifError(err);
        done();
      });
    });
  });

  describe("Networking: Cape", function () {
    it("should not fail (possible cape)", function (done) {
      helpers.get_cape(rid(), uuid, function (err) {
        assert.ifError(err);
        done();
      });
    });
  });

  describe("Errors", function () {
    before(async function () {
      await cache.get_redis().flushAll();
    });

    // Mojang has changed its rate limiting, so we no longer expect to hit the rate limit
    // it("uuid SHOULD be rate limited", function(done) {
    //   networking.get_profile(rid(), uuid, function() {
    //     networking.get_profile(rid(), uuid, function(err, profile) {
    //       assert.strictEqual(err.toString(), "HTTP: 429");
    //       assert.strictEqual(profile, null);
    //       done();
    //     });
    //   });
    // });

    it("CloudFront rate limit is handled", function (done) {
      const original_rate_limit = config.server.sessions_rate_limit;
      config.server.sessions_rate_limit = 1;
      networking.get_profile(rid(), uuid, function () {
        networking.get_profile(rid(), uuid, function (err) {
          assert.strictEqual(err.code, "RATELIMIT");
          config.server.sessions_rate_limit = original_rate_limit;
          done();
        });
      });
    });
  });

  after(function (done) {
    server.close(function (err) {
      if (err) {
        return done(err);
      }
      (async () => {
        try {
          await cache.get_redis().quit();
          done();
        } catch (e) {
          done(e);
        }
      })();
    });
  });
});

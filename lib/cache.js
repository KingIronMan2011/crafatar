import logging from "./logging.js";
import node_redis from "redis";
import config from "../config.js";

let redis = null;

// sets up redis connection
// flushes redis when using ephemeral storage (e.g. Heroku)
async function connect_redis() {
  logging.log("connecting to redis...");
  redis = node_redis.createClient(config.redis);
  redis.on("ready", async function() {
    logging.log("Redis connection established.");
    if (config.caching.ephemeral) {
      logging.log("Storage is ephemeral, flushing redis");
      await redis.flushAll();
    }
  });
  redis.on("error", function(err) {
    logging.error(err);
  });
  redis.on("end", function() {
    logging.warn("Redis connection lost!");
  });
  await redis.connect();
}

const exp = {};

// returns the redis instance
exp.get_redis = function() {
  return redis;
};

// set model type to value of *slim*
exp.set_slim = async function(rid, userId, slim, callback) {
  logging.debug(rid, "setting slim for", userId, "to " + slim);
  // store userId in lower case if not null
  userId = userId && userId.toLowerCase();

  try {
    await redis.hSet(userId, "a", Number(slim));
    callback(null);
  } catch (err) {
    callback(err);
  }
};

// sets the timestamp for +userId+
// if +temp+ is true, the timestamp is set so that the record will be outdated after 60 seconds
// these 60 seconds match the duration of Mojang's rate limit ban
// callback: error
exp.update_timestamp = async function(rid, userId, temp, callback) {
  logging.debug(rid, "updating cache timestamp (" + temp + ")");
  const sub = temp ? config.caching.local - 60 : 0;
  const time = Date.now() - sub;
  // store userId in lower case if not null
  userId = userId && userId.toLowerCase();
  try {
    await redis.hSet(userId, "t", time);
    callback(null);
  } catch (err) {
    callback(err);
  }
};

// create the key +userId+, store +skin_hash+, +cape_hash+, +slim+ and current time
// if +skin_hash+ or +cape_hash+ are undefined, they aren't stored
// this is useful to store cape and skin at separate times, without overwriting the other
// +slim+ can be true (alex) or false (steve)
// +callback+ contans error
exp.save_hash = async function(rid, userId, skin_hash, cape_hash, slim, callback) {
  logging.debug(rid, "caching skin:" + skin_hash + " cape:" + cape_hash + " slim:" + slim);
  // store shorter null value instead of "null" string
  skin_hash = skin_hash === null ? "" : skin_hash;
  cape_hash = cape_hash === null ? "" : cape_hash;
  // store userId in lower case if not null
  userId = userId && userId.toLowerCase();

  const fields = {};
  if (cape_hash !== undefined) {
    fields.c = cape_hash;
  }
  if (skin_hash !== undefined) {
    fields.s = skin_hash;
  }
  if (slim !== undefined) {
    fields.a = Number(!!slim);
  }
  fields.t = Date.now();

  try {
    await redis.hSet(userId, fields);
    callback(null);
  } catch (err) {
    callback(err);
  }
};

// removes the hash for +userId+ from the cache
exp.remove_hash = async function(rid, userId) {
  logging.debug(rid, "deleting hash from cache");
  await redis.del(userId.toLowerCase());
};

// get a details object for +userId+
// {skin: "0123456789abcdef", cape: "gs1gds1g5d1g5ds1", time: 1414881524512}
// callback: error, details
// details is null when userId not cached
exp.get_details = async function(userId, callback) {
  // get userId in lower case if not null
  userId = userId && userId.toLowerCase();
  try {
    const data = await redis.hGetAll(userId);
    let details = null;
    if (data && Object.keys(data).length > 0) {
      details = {
        skin: data.s === "" ? null : data.s,
        cape: data.c === "" ? null : data.c,
        slim: data.a === "1",
        time: Number(data.t)
      };
    }
    callback(null, details);
  } catch (err) {
    callback(err, null);
  }
};

connect_redis();
export default exp;
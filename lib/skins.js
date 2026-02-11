import logging from "./logging.js";
import sharp from "sharp";
import fs from "fs";

const exp = {};

// extracts the face from an image +buffer+
// result is saved to a file called +outname+
// callback: error
exp.extract_face = async function (buffer, outname, callback) {
  try {
    await sharp(buffer)
      .extract({ left: 8, top: 8, width: 8, height: 8 }) // face
      .flatten() // remove transparency
      .toFile(outname);
    callback(null);
  } catch (err) {
    callback(err);
  }
};

// extracts the helm from an image +buffer+ and lays it over a +facefile+
// +facefile+ is the filename of an image produced by extract_face
// result is saved to a file called +outname+
// callback: error
exp.extract_helm = async function (rid, facefile, buffer, outname, callback) {
  try {
    // Get the helm area to check for transparency
    const { data, info } = await sharp(buffer)
      .extract({ left: 32, top: 0, width: 32, height: 32 })
      .ensureAlpha() // ensure we have an alpha channel in the raw data
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Check if transparency-bounding-box has transparency
    let is_opaque = true;
    const channels = info.channels;
    const alphaIndex = channels - 1; // last channel is alpha after ensureAlpha()

    // Check for any non-opaque pixels (alpha < 255)
    for (let i = alphaIndex; i < data.length; i += channels) {
      if (data[i] < 255) {
        is_opaque = false;
        break;
      }
    }

    if (is_opaque) {
      logging.debug(rid, "Skin is not transparent, skipping helm!");
      callback(null);
      return;
    }

    // Extract helm (8x8 from position 40,8) - hat/helm overlay layer
    const helmBuffer = await sharp(buffer)
      .extract({ left: 40, top: 8, width: 8, height: 8 })
      .toBuffer();

    // Read face file and overlay helm
    const faceBuffer = await fs.promises.readFile(facefile);

    // Composite helm over face
    const compositeBuffer = await sharp(faceBuffer)
      .composite([{ input: helmBuffer, top: 0, left: 0 }])
      .toBuffer();

    // Compare with original face to see if different
    const faceData = await sharp(faceBuffer).raw().toBuffer();
    const compositeData = await sharp(compositeBuffer).raw().toBuffer();

    if (Buffer.compare(faceData, compositeData) !== 0) {
      await sharp(compositeBuffer).toFile(outname);
      callback(null);
    } else {
      logging.debug(rid, "helm img == face img, not storing!");
      callback(null);
    }
  } catch (err) {
    callback(err);
  }
};

// resizes the image file +inname+ to +size+ by +size+ pixels
// callback: error, image buffer
exp.resize_img = async function (inname, size, callback) {
  try {
    const buffer = await sharp(inname)
      .resize(size, size, { kernel: "nearest" }) // nearest-neighbor doesn't blur
      .toBuffer();
    callback(null, buffer);
  } catch (err) {
    callback(err, null);
  }
};

// returns "mhf_alex" or "mhf_steve" calculated by the +uuid+
exp.default_skin = function (uuid) {
  // great thanks to Minecrell for research into Minecraft and Java's UUID hashing!
  // https://git.io/xJpV
  // MC uses `uuid.hashCode() & 1` for alex
  // that can be compacted to counting the LSBs of every 4th byte in the UUID
  // an odd sum means alex, an even sum means steve
  // XOR-ing all the LSBs gives us 1 for alex and 0 for steve
  var lsbs_even =
    parseInt(uuid[7], 16) ^
    parseInt(uuid[15], 16) ^
    parseInt(uuid[23], 16) ^
    parseInt(uuid[31], 16);
  return lsbs_even ? "mhf_alex" : "mhf_steve";
};

// helper method for opening a skin file from +skinpath+
// callback: error, image buffer
exp.open_skin = function (rid, skinpath, callback) {
  fs.readFile(skinpath, function (err, buf) {
    if (err) {
      callback(err, null);
    } else {
      callback(null, buf);
    }
  });
};

// write the image +buffer+ to the +outpath+ file
// the image is stripped down by sharp.
// callback: error
exp.save_image = async function (buffer, outpath, callback) {
  try {
    await sharp(buffer).png().toFile(outpath);
    callback(null);
  } catch (err) {
    callback(err);
  }
};

export default exp;

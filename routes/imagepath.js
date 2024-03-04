const express = require("express");
const router = express.Router();
const {
  Getimagepath,
  IMAGEUPLOAD,
  IMAGESTORE,
} = require("../controller/Image");
router.get("/getimage/:image", Getimagepath);
router.get("/imagestore", IMAGESTORE);
router.post(
  "/imageupload",
  upload.fields([{ name: "image", maxCount: 10 }]),
  IMAGEUPLOAD
);
module.exports = router;

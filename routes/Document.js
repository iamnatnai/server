const express = require("express");
const router = express.Router();
const { DocEXCEL } = require("../controller/Document");
router.get("/excel", DocEXCEL);
module.exports = router;

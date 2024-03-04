const express = require("express");
const { checkAdmin, checkFarmer } = require("../middleware");
const router = express.Router();

router.post("/adduser", checkAdmin, postLogin);

module.exports = router;

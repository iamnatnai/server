const express = require("express");

const {
  checkAdmin,
  checkFarmer,
  checkIfExistsInAllTables,
} = require("../middleware");
const router = express.Router();

router.post("/adduser", checkAdmin, postLogin);

module.exports = router;

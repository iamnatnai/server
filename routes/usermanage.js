const express = require("express");
const { ChangePass } = require("../controller/authController");
const { Postaddfarmer, Postadduser } = require("../controller/addingalluser");
const {
  checkAdmin,
  checkFarmer,
  checkIfExistsInAllTables,
  checkTambon,
} = require("../middleware");
const router = express.Router();

router.post("/adduser", checkAdmin, Postadduser);
router.post("/addfarmer", checkTambon, Postaddfarmer);
router.post("/changepassword", ChangePass);
module.exports = router;

const express = require("express");
const { Forgot } = require("../controller/mailController");
const {
  postLogin,
  getLogin,
  postCheckingemail,
  postCheckinguser,
} = require("../controller/authController");
const { Register } = require("../controller/addingalluser");
const {
  checkAdmin,
  checkFarmer,
  checkIfExistsInAllTables,
} = require("../middleware");
const router = express.Router();
router.post("/login", postLogin);
router.get("/login", getLogin);
router.post("/forgot", checkIfExistsInAllTables, Forgot);
router.post("/checkinguser", postCheckinguser);
router.post("/checkingemail", postCheckingemail);
router.post("/register", Register);
module.exports = router;

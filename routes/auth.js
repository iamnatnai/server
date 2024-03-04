const express = require("express");
const {
  postLogin,
  getLogin,
  hello,
  hello2,
} = require("../controller/authController");
const { checkAdmin, checkFarmer } = require("../middleware");
const router = express.Router();

router.post("/login", postLogin);
router.get("/login", getLogin);
router.get("/hello", checkAdmin, hello);
router.get("/hello2", checkFarmer, hello2);

module.exports = router;

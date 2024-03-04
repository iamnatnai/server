const express = require("express");
const {
  Postcomment,
  GetComment,
  EditComment,
  DeleteComment,
} = require("../controller/Comment");

const router = express.Router();

router.post("/comment", Postcomment);
router.get("/getcomment/:id", GetComment);
router.post("/editcomment/:id", EditComment);
router.post("/deletecomment/:id", DeleteComment);
module.exports = router;

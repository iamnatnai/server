const express = require("express");
const multer = require("multer");
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = "./uploads";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const originalname = file.originalname.split(".")[0];
    const extension = file.originalname.split(".")[1];
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${originalname}-${uniqueSuffix}.${extension}`);
  },
});
const upload = multer({ storage: storage });
const {
  Postcomment,
  GetComment,
  EditComment,
  DeleteComment,
} = require("../controller/Comment");

const {
  checkAdmin,
  checkFarmer,
  checkIfExistsInAllTables,
} = require("../middleware");
const router = express.Router();
router.get("/standardproducts", StandardProduct);
router.post("/addproduct", checkFarmer, AddProduct);
router.get("/getproduct/:shopname/:product_id", GetProduct);
router.get("/getproducts", Getproducts);

module.exports = router;

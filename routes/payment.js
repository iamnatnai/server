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
  PostCheckout,
  Getpayment,
  Postfarmerorder,
  GetOrderlist,
  Getfarmerorder,
  Postconfirmorder,
  Postconfirmtransection,
} = require("../controller/PaymentSystem");
const router = express.Router();
router.post(
  "/checkout",
  upload.fields([{ name: "productSlip", maxCount: 1 }]),
  PostCheckout
);
router.get("/getpayment/:id", Getpayment);
router.post("/farmerorder", Postfarmerorder);
router.get("/farmerorder", Getfarmerorder);
router.get("/orderlist", GetOrderlist);
router.post("/confirmorder", Postconfirmorder);
router.post(
  "/confirmtrancsaction",
  upload.fields([{ name: "productSlip", maxCount: 1 }], Postconfirmtransection)
);
module.exports = router;

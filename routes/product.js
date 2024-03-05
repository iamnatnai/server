const express = require("express");
const {
  StandardProduct,
  AddProduct,
  GetProduct,
  Getproducts,
  Deleteproduct,
  Getupdatereview,
  Getmyproduct,
} = require("../controller/ProductSystem");
const { checkFarmer } = require("../middleware");
const router = express.Router();
router.get("/standardproducts", StandardProduct);
router.post("/addproduct", checkFarmer, AddProduct);
router.get("/getproduct/:shopname/:product_id", GetProduct);
router.get("/getproducts", Getproducts);
router.delete("/deleteproduct/:id", checkFarmer, Deleteproduct);
router.get("/updateview/:id", Getupdatereview);
router.get("/myproducts/:username", Getmyproduct);
module.exports = router;

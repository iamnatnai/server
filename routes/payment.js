router.post(
  "/checkout",
  upload.fields([{ name: "productSlip", maxCount: 1 }]),
  Postcomment
);

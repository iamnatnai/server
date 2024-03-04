const express = require("express");
const bodyParser = require("body-parser");
const mysql = require("mysql2");
const cors = require("cors");
const authRouter = require("./routes/auth.js");
const userMangeRouter = require("./routes/usermanage.js");
const app = express();
const port = 3000;
require("dotenv").config();

app.use(
  cors({
    origin: "*",
  })
);
app.use(express.json());
app.use(authRouter());
app.use(userMangeRouter());

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

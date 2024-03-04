const checkAdmin = (req, res, next) => {
  const token = req.headers.authorization
    ? req.headers.authorization.split(" ")[1]
    : null;
  if (!token) {
    return res.status(400).json({ error: "Token not provided" });
  }
  try {
    const decoded = jwt.verify(token, secretKey);
    if (decoded.role !== "admins") {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  } catch (error) {
    console.error("Error decoding token:1", error.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const checkTambon = (req, res, next) => {
  const token = req.headers.authorization
    ? req.headers.authorization.split(" ")[1]
    : null;
  if (!token) {
    return res.status(400).json({ error: "Token not provided" });
  }
  try {
    const decoded = jwt.verify(token, secretKey);
    if (decoded.role !== "tambons") {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  } catch (error) {
    console.error("Error decoding token:2", error.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const checkFarmer = (req, res, next) => {
  const token = req.headers.authorization
    ? req.headers.authorization.split(" ")[1]
    : null;
  if (!token) {
    return res.status(400).json({ error: "Token not provided" });
  }
  try {
    const decoded = jwt.verify(token, secretKey);
    console.log(decoded);
    if (
      decoded.role !== "farmers" &&
      decoded.role !== "admins" &&
      decoded.role !== "tambons"
    ) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  } catch (error) {
    console.error("Error decoding token:3", error.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = {
  checkAdmin,
  checkTambon,
  checkFarmer,
};

const ExtractJwt = require("passport-jwt").ExtractJwt;
const JwtStrategy = require("passport-jwt").Strategy;
const jwt = require("jsonwebtoken");
const passport = require("passport");
const secretKey = "pifOvrart4";
const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromHeader("authorization"),
  secretOrKey: secretKey,
};
async function getUserByUsername(username) {
  return usePooledConnectionAsync(async (db) => {
    return await new Promise((resolve, reject) => {
      db.query(
        `
    SELECT 'admins' AS role, id AS user_id, username AS uze_name, password AS pazz FROM admins WHERE username = ? and available = 1
    UNION
    SELECT 'farmers' AS role, id AS user_id, username AS uze_name, password AS pazz FROM farmers WHERE username = ? and available = 1
    UNION
    SELECT 'members' AS role, id AS user_id, username AS uze_name, password AS pazz FROM members WHERE username = ? and available = 1
    UNION
    SELECT 'providers' AS role, id AS user_id, username AS uze_name, password AS pazz FROM providers WHERE username = ? and available = 1
    UNION
    SELECT 'tambons' AS role, id AS user_id, username AS uze_name, password AS pazz FROM tambons WHERE username = ? and available = 1
    `,
        [username, username, username, username, username],
        (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result.length > 0 ? result[0] : null);
          }
        }
      );
    });
  });
}

const jwtAuth = new JwtStrategy(jwtOptions, async (payload, done) => {
  try {
    const user = await getUserByUsername(payload.sub);

    if (!user) {
      return done(null, false);
    }

    const passwordMatch = await bcrypt.compare(payload.password, user.pazz);

    if (!passwordMatch) {
      return done(null, false);
    }
    return done(null, user);
  } catch (error) {
    return done(error, false);
  }
});

passport.use(jwtAuth);

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

async function checkIfExists(role, column, value) {
  return await usePooledConnectionAsync(async (db) => {
    new Promise(async (resolve, reject) => {
      db.query(
        `SELECT * FROM ${role} WHERE ${column} = ?`,
        [value],
        (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result.length > 0);
          }
        }
      );
    });
  });
}

async function checkIfExistsInAllTables(column, value) {
  const tables = ["admins", "farmers", "members", "providers", "tambons"];
  const promises = tables.map((table) => checkIfExists(table, column, value));
  const results = await Promise.all(promises);
  return results.some((result) => result);
}

module.exports = {
  checkAdmin,
  checkTambon,
  checkFarmer,
  checkIfExistsInAllTables,
  getUserByUsername,
  secretKey,
};

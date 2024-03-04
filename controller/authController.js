const bcrypt = require("bcrypt");
const { insertMember } = require("../controller/addingalluser");
const {
  secretKey,
  checkAdmin,
  checkFarmer,
  checkIfExistsInAllTables,
} = require("../middleware");

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

const postLogin = async (req, res) => {
  const { username, password } = req.body;
  console.log(123);
  if (!username || !password) {
    return res
      .status(400)
      .send({ status: false, error: "Missing required fields" });
  }

  try {
    const user = await getUserByUsername(username);

    if (!user) {
      return res
        .status(401)
        .send({ status: false, error: "Invalid username or password" });
    }
    console.log("User:", user.uze_name);
    console.log("Password:", password);
    console.log("Hash Password:", user.pazz);
    console.log("role:", user.role);
    console.log("+++++++++++++++++++++++++++++++++++++++");
    const passwordMatch = await bcrypt.compare(password, user.pazz);

    if (!passwordMatch) {
      console.log("not");
      return res
        .status(401)
        .send({ status: false, error: "Invalid username or password" });
    }

    const token = jwt.sign(
      { username: user.uze_name, ID: user.user_id, role: user.role },
      secretKey,
      {
        expiresIn: "15d",
      }
    );

    console.log("Generated token:", token);

    res.status(200).send({
      status: true,
      memberId: user.user_id,
      username: user.uze_name,
      role: user.role,
      token: token,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ status: false, error: "Internal Server Error" });
  }
};

const getLogin = (req, res) => {
  const token = req.headers.authorization
    ? req.headers.authorization.split(" ")[1]
    : null;

  if (!token) {
    return res.status(400).json({ error: "Token not provided" });
  }
  try {
    const decoded = jwt.verify(token, secretKey);
    const newToken = jwt.sign(
      { username: decoded.username, ID: decoded.ID, role: decoded.role },
      secretKey,
      {
        expiresIn: "15d",
      }
    );

    return res.status(200).json({ isValid: true, newToken: newToken });
  } catch (error) {
    console.error("Error decoding token:4", error.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const postCheckinguser = async (req, res) => {
  const username = req.body.username;
  await usePooledConnectionAsync(async (db) => {
    db.query(
      `
      SELECT 'admins' AS role, username FROM admins WHERE username = ?
      UNION
      SELECT 'farmers' AS role, username FROM farmers WHERE username = ?
      UNION
      SELECT 'members' AS role, username FROM members WHERE username = ?
      UNION
      SELECT 'providers' AS role, username FROM providers WHERE username = ?
      UNION
      SELECT 'tambon' AS role, username FROM tambons WHERE username = ?
      `,
      [username, username, username, username, username],
      (err, result) => {
        if (err) {
          console.log(err);
          res
            .status(500)
            .send({ exist: false, error: "Internal Server Error" });
        } else {
          if (result.length > 0) {
            res.send({ username: result[0].username, exist: true });
          } else {
            res.send({ username: username, exist: false });
          }
        }
      }
    );
  });
};

const postCheckingemail = (req, res) => {
  const email = req.body.email;
  usePooledConnectionAsync(async (db) => {
    db.query(
      `
      SELECT 'admins' AS role, email FROM admins WHERE email = ?
      UNION
      SELECT 'farmers' AS role, email FROM farmers WHERE email = ?
      UNION
      SELECT 'members' AS role, email FROM members WHERE email = ?
      UNION
      SELECT 'providers' AS role, email FROM providers WHERE email = ?
      UNION
      SELECT 'tambon' AS role, email FROM tambons WHERE email = ?
      `,
      [email, email, email, email, email],
      (err, result) => {
        if (err) {
          console.log(err);
          res
            .status(500)
            .send({ exist: false, error: "Internal Server Error" });
        } else {
          if (result.length > 0) {
            res.send({ email: result[0].email, exist: true });
          } else {
            res.send({ email: email, exist: false });
          }
        }
      }
    );
  });
};
app.post("/changepassword", async (req, res) => {
  const { oldpassword, newpassword, usernameBody, roleBody } = req.body;
  const token = req.headers.authorization
    ? req.headers.authorization.split(" ")[1]
    : null;

  const checkMatchPssword = async (role, username, password) => {
    return await usePooledConnectionAsync(async (db) => {
      const hashedPassword = await new Promise(async (resolve, reject) => {
        db.query(
          `SELECT password FROM ${role} WHERE username = "${username}"`,
          (err, result) => {
            if (err) {
              reject(err);
            } else {
              resolve(result[0].password);
            }
          }
        );
      });

      const passwordMatch = await bcrypt.compare(password, hashedPassword);
      return passwordMatch;
    });
  };
  if (!token) {
    return res
      .status(400)
      .json({ success: false, message: "Token not provided" });
  }

  const decoded = jwt.verify(token, secretKey);
  var { role: roleDecoded, username: usernameDecoded } = decoded;

  try {
    // ถ้าไม่ใช่ admin ต้องเช็คว่า password เดิมตรงกับที่อยู่ใน database หรือไม่
    if (roleDecoded !== "admins") {
      if (
        !(await checkMatchPssword(roleDecoded, usernameDecoded, oldpassword))
      ) {
        console.log("Password not match");
        return res
          .status(400)
          .json({ success: false, message: "Password not match" });
      }
    }

    const newHashedPassword = await bcrypt.hash(newpassword, 10);
    await usePooledConnectionAsync(async (db) => {
      return await new Promise((resolve, reject) => {
        db.query(
          `UPDATE ${
            roleDecoded !== "admins" ? roleDecoded : roleBody
          } SET password = "${newHashedPassword}" WHERE username = "${
            roleDecoded !== "admins" ? usernameDecoded : usernameBody
          }"`,
          (err, result) => {
            if (err) {
              reject(err);
            } else {
              resolve(result);
            }
          }
        );
      });
    });

    return res
      .status(200)
      .json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    console.error("Error changing password:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
});

module.exports = {
  getUserByUsername,
  postLogin,
  getLogin,
  postCheckingemail,
  postCheckinguser,
};

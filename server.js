const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const bcrypt = require("bcrypt");
const passport = require("passport");
const app = express();
const nodemailer = require("nodemailer");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const port = 3000;
const ExtractJwt = require("passport-jwt").ExtractJwt;
const JwtStrategy = require("passport-jwt").Strategy;
const jwt = require("jsonwebtoken");
const secretKey = "pifOvrart4";
const util = require("util");
const excel = require("exceljs");
const moment = require("moment");
const momentz = require("moment-timezone");
const { log, error } = require("console");
const { decode } = require("punycode");

require("dotenv").config();
//ดึงตัวแปรมาใช้

app.use(
  cors({
    origin: "*",
  })
);
app.use(express.json());
var db_config = {
  host: "localhost",
  // port: "18574",
  socketPath:
    process.env.production == "true"
      ? //Server: Localhost via UNIX socket(ดูใน php myadmin)
        "/var/run/mysqld/mysqld.sock"
      : undefined,
  user: process.env.production == "true" ? "thebestkasetnont" : "root",
  password: process.env.production == "true" ? "xGHYb$#34f2RIGhJc" : "",
  database:
    process.env.production == "true" ? "thebestkasetnont" : "kaset_data",
  charset: "utf8mb4",
  typeCast: function (field, next) {
    if (field.type === "TINY" && field.length === 1) {
      return field.string() === "1"; // 1 = true, 0 = false
    }
    return next();
  },
};
pool = mysql.createPool(db_config);
pool.query = util.promisify(pool.query);
async function usePooledConnectionAsync(actionAsync) {
  const connection = await new Promise((resolve, reject) => {
    pool.getConnection((ex, connection) => {
      if (ex) {
        reject(ex);
      } else {
        resolve(connection);
      }
    });
  });
  try {
    return await actionAsync(connection);
  } finally {
    connection.release();
  }
}

const createNotification = async (
  sender_id,
  recipient_id,
  message,
  link,
  type,
  index = 0
) => {
  return await usePooledConnectionAsync(async (db) => {
    try {
      let id = await new Promise(async (resolve, reject) => {
        db.query("SELECT MAX(id) as maxId FROM notification", (err, result) => {
          if (err) {
            reject(err);
          } else {
            let nextId = "NOTI00000001";
            if (result[0].maxId) {
              const currentId = result[0].maxId;
              const numericPart =
                parseInt(currentId.substring(4), 10) + 1 + index;

              nextId = "NOTI" + numericPart.toString().padStart(8, "0");
            }
            resolve(nextId);
          }
        });
      });
      return new Promise((resolve, reject) => {
        db.query(
          `INSERT INTO notification (id, sender_id, recipient_id, message, link,type, timesent) VALUES (?,?, ?, ?, ?, ?, NOW())`,
          [id, sender_id, recipient_id, message, link, type],
          (err, result) => {
            if (err) {
              reject(err);
            } else {
              resolve(result);
            }
          }
        );
      });
    } catch (error) {
      console.error("Error creating notification:", error);
      throw error;
    }
  });
};

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
    return res.status(500).json({ error: "Internal Server Error 1234" });
  }
};
const checkAdminTambon = (req, res, next) => {
  const token = req.headers.authorization
    ? req.headers.authorization.split(" ")[1]
    : null;
  if (!token) {
    return res.status(400).json({ error: "Token not provided" });
  }
  try {
    const decoded = jwt.verify(token, secretKey);
    if (decoded.role !== "admins" && decoded.role !== "tambons") {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  } catch (error) {
    console.error("Error decoding token:1", error.message);
    return res.status(500).json({ error: JSON.stringify(error) });
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
const checkTambonProvider = (req, res, next) => {
  const token = req.headers.authorization
    ? req.headers.authorization.split(" ")[1]
    : null;
  if (!token) {
    return res.status(400).json({ error: "Token not provided" });
  }
  try {
    const decoded = jwt.verify(token, secretKey);
    if (
      decoded.role !== "tambons" &&
      decoded.role !== "providers" &&
      decoded.role !== "admins"
    ) {
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

const checkActivated = (req, res, next) => {
  const token = req.headers.authorization
    ? req.headers.authorization.split(" ")[1]
    : null;
  if (!token) {
    return res.status(400).json({ error: "Token not provided" });
  }
  try {
    const decoded = jwt.verify(token, secretKey);
    if (decoded.role === "members" && !decoded.activate) {
      return res
        .status(401)
        .json({ success: false, message: "กรุณายืนยันตัวตนก่อนใช้งาน" });
    }
    next();
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

app.post("/checkinguser", async (req, res) => {
  const username = req.body.username;
  await usePooledConnectionAsync(async (db) => {
    db.query(
      `
      SELECT 'admins' AS role, username FROM admins WHERE username = ? and available = 1
      UNION
      SELECT 'farmers' AS role, username FROM farmers WHERE username = ? and available = 1
      UNION
      SELECT 'members' AS role, username FROM members WHERE username = ? and available = 1
      UNION
      SELECT 'providers' AS role, username FROM providers WHERE username = ? and available = 1
      UNION
      SELECT 'tambon' AS role, username FROM tambons WHERE username = ? and available = 1
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
});

app.post("/checkingemail", (req, res) => {
  const email = req.body.email;
  usePooledConnectionAsync(async (db) => {
    db.query(
      `
      SELECT 'admins' AS role, email FROM admins WHERE email = ? and available = 1
      UNION
      SELECT 'farmers' AS role, email FROM farmers WHERE email = ? and available = 1
      UNION
      SELECT 'members' AS role, email FROM members WHERE email = ? and available = 1
      UNION
      SELECT 'providers' AS role, email FROM providers WHERE email = ? and available = 1
      UNION
      SELECT 'tambon' AS role, email FROM tambons WHERE email = ? and available = 1
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
});

app.post("/register", async (req, res) => {
  const { username, email, password, firstName, lastName, tel } = req.body;
  if (
    username === "" ||
    email === "" ||
    password === "" ||
    firstName === "" ||
    lastName === "" ||
    tel === ""
  ) {
    return res
      .status(400)
      .send({ exist: false, error: "Missing required fields" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const usernameExists = await checkIfExistsInAllTables("username", username);
    const emailExists = await checkIfExistsInAllTables("email", email);

    if (usernameExists) {
      return res
        .status(409)
        .send({ exist: false, error: "Username already exists" });
    }

    if (emailExists) {
      return res
        .status(409)
        .send({ exist: false, error: "Email already exists" });
    }

    const nextId = await getNextId();

    await insertMember(
      nextId,
      username,
      email,
      hashedPassword,
      firstName,
      lastName,
      tel
    );

    res.status(201).send({ exist: true });
  } catch (error) {
    console.error(error);
    res.status(500).send({ exist: false, error: "Internal Server Error" });
  }
});

app.get("/confirm/:email/:hashed", async (req, res) => {
  const email = req.params.email;
  const hashed = decodeURIComponent(req.params.hashed).replace(/slash/g, "/");

  if (!email || !hashed) {
    return res
      .status(400)
      .send({ success: false, error: "Missing required fields" });
  }

  if (!(await bcrypt.compare(email + secretKey, hashed))) {
    return res
      .status(400)
      .send({ success: false, error: "Invalid email confirmation link" });
  }

  await usePooledConnectionAsync(async (db) => {
    db.query(
      "UPDATE members SET activate = 1 WHERE email = ?",
      [email],
      (err, result) => {
        if (err) {
          console.error("Error confirming email:", err);
          res
            .status(500)
            .send({ success: false, error: "Internal Server Error" });
        } else {
          db.query(
            "SELECT * FROM members WHERE email = ? and available = 1",
            [email],
            (err, result) => {
              if (err) {
                console.error("Error confirming email:", err);
                res
                  .status(500)
                  .send({ success: false, error: "Internal Server Error" });
              } else {
                const token = jwt.sign(
                  {
                    sub: result[0].username,
                    role: "members",
                    activate: true,
                  },
                  secretKey
                );
                res.status(200).send({
                  success: true,
                  newToken: token,
                  message: "Email confirmed successfully",
                });
              }
            }
          );
        }
      }
    );
  });
});

async function checkIfExists(role, column, value) {
  return await usePooledConnectionAsync(async (db) => {
    return new Promise(async (resolve, reject) => {
      db.query(
        `SELECT * FROM ${role} WHERE ${column} = ? and available = 1`,
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

async function getNextCertId(index = 0) {
  return await usePooledConnectionAsync(async (db) => {
    return;
  });
}

async function insertFarmer(
  nextUserId,
  username,
  email,
  amphure,
  hashedPassword,
  firstName,
  lastName,
  tel,
  certificateList,
  address,
  lat,
  lng
) {
  return await usePooledConnectionAsync(async (db) => {
    await new Promise((resolve, reject) => {
      const query = `INSERT INTO farmers 
      (id, username, email, password, firstname, lastname, phone, role, amphure, farmerstorename, address, lat, lng, createAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`;
      db.query(
        query,
        [
          nextUserId,
          username,
          email,
          hashedPassword,
          firstName,
          lastName,
          tel,
          "farmers",
          amphure,
          username,
          address,
          lat,
          lng,
        ],
        (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        }
      );
    });
    if (certificateList) {
      certificateList.map(async (certificate, index) => {
        let nextCertId = await getNextCertId(index);
        await new Promise((resolve, reject) => {
          const query = `INSERT INTO certificate_link_farmer 
          (id, farmer_id, standard_id, status) 
          VALUES (?,?, ?, "complete")`;
          db.query(
            query,
            [nextCertId, nextUserId, certificate],
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
    }
    return;
  });
}
async function insertTambon(
  nextUserId,
  username,
  email,
  amphure,
  hashedPassword,
  firstName,
  lastName,
  tel
) {
  return await usePooledConnectionAsync(async (db) => {
    await new Promise((resolve, reject) => {
      const query = `INSERT INTO tambons 
      (id, username, email, password, firstname, lastname, phone, role, amphure, createAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`;
      db.query(
        query,
        [
          nextUserId,
          username,
          email,
          hashedPassword,
          firstName,
          lastName,
          tel,
          "tambons",
          amphure,
        ],
        (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        }
      );
    });
    return;
  });
}

app.post("/adduser", checkAdminTambon, async (req, res) => {
  const {
    username,
    email,
    password,
    firstName,
    lastName,
    amphure,
    tel,
    role,
    certificateList,
    address,
    lat,
    lng,
  } = req.body;
  if (!username || !password || !role) {
    return res
      .status(400)
      .json({ success: false, message: "Missing required fields" });
  }

  try {
    const token = req.headers.authorization
      ? req.headers.authorization.split(" ")[1]
      : null;
    const decoded = jwt.verify(token, secretKey);

    if (decoded.role === "tambons" && role !== "farmers") {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const usernameExists = await checkIfExistsInAllTables("username", username);
    const emailExists = await checkIfExistsInAllTables("email", email);
    if (usernameExists) {
      return res
        .status(409)
        .json({ success: false, message: "Username already exists" });
    }
    if (emailExists && email != "") {
      return res
        .status(409)
        .json({ success: false, message: "Email already exists" });
    }
    const nextUserId = await getNextUserId(role);
    if (role === "farmers") {
      await insertFarmer(
        nextUserId,
        username,
        email,
        amphure,
        hashedPassword,
        firstName,
        lastName,
        tel,
        certificateList,
        address,
        lat,
        lng
      );
    } else if (role === "tambons") {
      await insertTambon(
        nextUserId,
        username,
        email,
        amphure,
        hashedPassword,
        firstName,
        lastName,
        tel
      );
    } else if (role === "members") {
      await insertMember(
        nextUserId,
        username,
        email,
        hashedPassword,
        firstName,
        lastName,
        tel
      );
    } else {
      await insertUser(
        nextUserId,
        username,
        email,
        hashedPassword,
        firstName,
        lastName,
        tel,
        role
      );
    }

    res.status(201).json({ success: true, message: "User added successfully" });
  } catch (error) {
    console.error("Error adding user:", error);
    res.status(500).json({ success: false, message: JSON.stringify(error) });
  }
});

app.get("/role", async (req, res) => {
  await usePooledConnectionAsync(async (db) => {
    db.query(
      "SELECT 'admins' AS role_id, 'ผู้ดูแลระบบ' AS role_name FROM admins UNION SELECT 'members' AS role_id, 'สมาชิก' AS role_name FROM members UNION SELECT 'farmers' AS role_id, 'เกษตรกร' AS role_name FROM providers UNION SELECT 'providers' AS role_id, 'เกษตรจังหวัด' AS role_name FROM providers UNION SELECT 'tambons' AS role_id, 'เกษตรตำบล' AS role_name FROM tambons;",
      (err, result) => {
        if (err) {
          console.log(err);
          res
            .status(500)
            .send({ exist: false, error: "Internal Server Error" });
        } else {
          res.json(result);
        }
      }
    );
  });
});

app.get("/users/:roleParams", async (req, res) => {
  const token = req.headers.authorization
    ? req.headers.authorization.split(" ")[1]
    : null;
  const { roleParams } = req.params;

  try {
    const decoded = jwt.verify(token, secretKey);
    const role = decoded.role;

    if (role !== "admins" && role !== "tambons" && role !== "providers") {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (role === "tambons" && roleParams !== "farmers") {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (
      roleParams !== "admins" &&
      roleParams !== "farmers" &&
      roleParams !== "members" &&
      roleParams !== "providers" &&
      roleParams !== "tambons"
    ) {
      return res.status(400).json({ error: "Invalid role" });
    }

    await usePooledConnectionAsync(async (db) => {
      if (roleParams === "admins") {
        db.query("SELECT * FROM admins WHERE available = 1", (err, result) => {
          if (err) {
            console.log(err);
            res
              .status(500)
              .send({ exist: false, error: "Internal Server Error" });
          } else {
            res.json(result);
          }
        });
      } else if (roleParams === "farmers") {
        db.query(
          `SELECT * FROM farmers WHERE available = 1 ${
            role === "tambons" ? `AND amphure = "${decoded.amphure}"` : ""
          } ORDER BY createAt DESC`,
          async (err, result) => {
            if (err) {
              console.log(err);
              res
                .status(500)
                .send({ exist: false, error: "Internal Server Error" });
            } else {
              try {
                let compiledResult = await Promise.all(
                  result.map(async (farmer) => {
                    let certiCount = await new Promise((resolve, reject) => {
                      db.query(
                        "SELECT count(*) as count FROM certificate_link_farmer WHERE farmer_id = ? and status = 'complete'",
                        [farmer.id],
                        (err, certResult) => {
                          if (err) {
                            reject(err);
                          } else {
                            resolve(certResult[0]["count"]);
                          }
                        }
                      );
                    });
                    let productCount = await new Promise((resolve, reject) => {
                      db.query(
                        "SELECT count(*) as count FROM products WHERE farmer_id = ? and available = 1",
                        [farmer.id],
                        (err, productResult) => {
                          if (err) {
                            reject(err);
                          } else {
                            resolve(productResult[0]["count"]);
                          }
                        }
                      );
                    });

                    let allCertifications = await new Promise(
                      (resolve, reject) => {
                        db.query(
                          "SELECT * FROM certificate_link_farmer WHERE farmer_id = ? and status = 'complete'",
                          [farmer.id],
                          (err, certResult) => {
                            if (err) {
                              reject(err);
                            } else {
                              resolve(certResult);
                            }
                          }
                        );
                      }
                    );

                    let allProductCategory = await new Promise(
                      (resolve, reject) => {
                        db.query(
                          "SELECT count(*) as count, c.category_name, c.bgcolor FROM products p JOIN categories c on p.category_id = c.category_id WHERE farmer_id = ? and p.available = 1 group by c.category_name",
                          [farmer.id],
                          (err, productResult) => {
                            if (err) {
                              reject(err);
                            } else {
                              resolve(productResult);
                            }
                          }
                        );
                      }
                    );

                    return {
                      ...farmer,
                      certiCount: certiCount,
                      productCount: productCount,
                      certificates: allCertifications,
                      categories: allProductCategory,
                    };
                  })
                );
                res.json(compiledResult);
              } catch (error) {
                console.error(error);
                res
                  .status(500)
                  .send({ exist: false, error: "Internal Server Error" });
              }
            }
          }
        );
      } else if (roleParams === "members") {
        db.query("SELECT * FROM members WHERE available = 1", (err, result) => {
          if (err) {
            console.log(err);
            res
              .status(500)
              .send({ exist: false, error: "Internal Server Error" });
          } else {
            res.json(result);
          }
        });
      } else if (roleParams === "providers") {
        db.query(
          "SELECT * FROM providers WHERE available = 1",
          (err, result) => {
            if (err) {
              console.log(err);
              res
                .status(500)
                .send({ exist: false, error: "Internal Server Error" });
            } else {
              res.json(result);
            }
          }
        );
      } else if (roleParams === "tambons") {
        db.query("SELECT * FROM tambons WHERE available = 1", (err, result) => {
          if (err) {
            console.log(err);
            res
              .status(500)
              .send({ exist: false, error: "Internal Server Error" });
          } else {
            res.json(result);
          }
        });
      }
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.delete("/deleteuser/:role/:username", async (req, res) => {
  await usePooledConnectionAsync(async (db) => {
    try {
      //soft delete
      const token = req.headers.authorization
        ? req.headers.authorization.split(" ")[1]
        : null;

      const decoded = jwt.verify(token, secretKey);
      if (decoded.role !== "admins" && decoded.role !== "tambons") {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const { role, username } = req.params;
      if (decoded.role === "tambons" && role !== "farmers") {
        return res.status(401).json({ error: "Unauthorized" });
      }

      let id = await new Promise((resolve, reject) => {
        db.query(
          `SELECT id FROM ${role} WHERE username = ? and available = 1`,
          [username],
          (err, result) => {
            if (err) {
              throw Error(err);
            } else {
              resolve(result[0].id);
            }
          }
        );
      });
      const query = `UPDATE ${role} SET available = 0 WHERE id = "${id}" and available = 1`;
      db.query(query, async (err, result) => {
        if (err) {
          console.error("Error deleting user:", err);
          throw Error(err);
        }
        if (role === "farmers") {
          const query = `UPDATE products SET available = 0 WHERE farmer_id = "${id}" and available = 1`;
          db.query(query, (err, result) => {
            if (err) {
              throw Error(err);
            }
            return res
              .status(200)
              .json({ success: true, message: "User deleted successfully" });
          });
        }
      });
    } catch (error) {
      console.error("Error deleting user:", error);
      return res
        .status(500)
        .json({ success: false, message: JSON.stringify(error) });
    }
  });
});

async function getNextId() {
  return await usePooledConnectionAsync(async (db) => {
    return await new Promise(async (resolve, reject) => {
      db.query("SELECT MAX(id) as maxId FROM members", (err, result) => {
        if (err) {
          reject(err);
        } else {
          let nextId = "MEM000001";
          if (result[0].maxId) {
            const currentId = result[0].maxId;
            const numericPart = parseInt(currentId.substring(3), 10) + 1;

            nextId = "MEM" + numericPart.toString().padStart(6, "0");
          }
          resolve(nextId);
        }
      });
    });
  });
}
async function getNextUserId(role) {
  let rolePrefix = "";
  switch (role) {
    case "admins":
      rolePrefix = "ADMIN";
      break;
    case "members":
      rolePrefix = "MEM";
      break;
    case "farmers":
      rolePrefix = "FARM";
      break;
    case "providers":
      rolePrefix = "PROV";
      break;
    case "tambons":
      rolePrefix = "TB";
      break;
  }
  return await usePooledConnectionAsync(async (db) => {
    return new Promise(async (resolve, reject) => {
      db.query(`SELECT MAX(id) as maxId FROM ${role}`, (err, result) => {
        if (err) {
          reject(err);
        } else {
          let nextUserId = `${rolePrefix}000001`;
          if (result[0].maxId) {
            const currentId = result[0].maxId;
            const numericPart =
              parseInt(currentId.substring(rolePrefix.length), 10) + 1;
            nextUserId = `${rolePrefix}${numericPart
              .toString()
              .padStart(6, "0")}`;
          }
          resolve(nextUserId);
        }
      });
    });
  });
}

async function insertMember(
  memberId,
  username,
  email,
  password,
  firstName,
  lastName,
  tel
) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "thebestkasetnont@gmail.com",
      pass: "ggtf brgm brip mqvq",
    },
  });
  let url =
    process.env.production == "true"
      ? process.env.url
      : "http://localhost:3000";
  const mailOptions = {
    from: "thebestkasetnont@gmail.com",
    to: email,
    subject: "ยืนยันตัวตน",
    text: `สวัสดีคุณ ${firstName} ${lastName} คุณได้สมัครสมาชิกกับเว็บไซต์ ${url} 
    กรุณายืนยันตัวตนโดยคลิกที่ลิงค์นี้: ${url}/#/confirm/${email}/${encodeURIComponent(
      (await bcrypt.hash(email + secretKey, 10)).replace(/\//g, "slash")
    )}`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error("Error sending email:", error);
    } else {
      console.log("Email sent:", info.response);
    }
  });

  return await usePooledConnectionAsync(async (db) => {
    new Promise(async (resolve, reject) => {
      db.query(
        `INSERT INTO members (id, username, email, password, firstname, lastname, phone, member_follows, role) 
        VALUES (?, ?, ?, ?, ?, ?, ?,?,?)`,
        [
          memberId,
          username,
          email,
          password,
          firstName,
          lastName,
          tel,
          null,
          "members",
        ],
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
}

async function insertUser(
  memberId,
  username,
  email,
  password,
  firstName,
  lastName,
  tel,
  role
) {
  return await usePooledConnectionAsync(async (db) => {
    return new Promise((resolve, reject) => {
      db.query(
        `INSERT INTO ${role} 
        (id,username,email,password,firstname,lastName,phone,role) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [memberId, username, email, password, firstName, lastName, tel, role],
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
}
const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromHeader("authorization"),
  secretOrKey: secretKey,
};

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

app.post("/login", async (req, res) => {
  const { username, password, rememberMe } = req.body;
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
    const passwordMatch = await bcrypt.compare(password, user.pazz);

    if (!passwordMatch) {
      return res
        .status(401)
        .send({ status: false, error: "Invalid username or password" });
    }
    usePooledConnectionAsync(async (db) => {
      db.query(
        `UPDATE ${user.role} SET lastLogin = NOW() WHERE username = ? and available = 1`,
        [username],
        (err, result) => {
          if (err) {
            console.error("Error updating last login:", err);
          }
        }
      );
    });
    let option = { username: user.uze_name, ID: user.user_id, role: user.role };
    if (user.role === "members") {
      let activation = await usePooledConnectionAsync(async (db) => {
        return new Promise((resolve, reject) => {
          db.query(
            "SELECT activate FROM members WHERE username = ? and available = 1",
            [user.uze_name],
            (err, result) => {
              if (err) {
                reject(err);
              } else {
                resolve(result[0].activate);
              }
            }
          );
        });
      });

      option = { ...option, activate: activation };
    }

    if (user.role === "tambons") {
      let tambonamphure = await usePooledConnectionAsync(async (db) => {
        return new Promise((resolve, reject) => {
          db.query(
            "SELECT amphure FROM tambons WHERE username = ? and available = 1",
            [user.uze_name],
            (err, result) => {
              if (err) {
                reject(err);
              } else {
                resolve(result[0].amphure);
              }
            }
          );
        });
      });

      option = { ...option, amphure: tambonamphure };
    }

    const token = jwt.sign(option, secretKey, {
      expiresIn: rememberMe ? "15d" : "1d",
    });

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
});

app.get("/login", async (req, res) => {
  const token = req.headers.authorization
    ? req.headers.authorization.split(" ")[1]
    : null;

  if (!token) {
    return res.status(400).json({ error: "Token not provided" });
  }
  try {
    const decoded = jwt.verify(token, secretKey);
    let option = {
      username: decoded.username,
      ID: decoded.ID,
      role: decoded.role,
    };
    if (decoded.role === "members") {
      option = { ...option, activate: decoded.activate };
    }
    if (decoded.role === "tambons") {
      option = { ...option, amphure: decoded.amphure };
    }
    const newToken = jwt.sign(option, secretKey, {
      expiresIn: "15d",
    });
    usePooledConnectionAsync(async (db) => {
      db.query(
        `UPDATE ${decoded.role} SET lastLogin = NOW() WHERE username = ? and available = 1`,
        [decoded.username],
        (err, result) => {
          if (err) {
            console.error("Error updating last login:", err);
          }
        }
      );
    });
    return res.status(200).json({ isValid: true, newToken: newToken });
  } catch (error) {
    console.error("Error decoding token:4", error.message);
    return res.status(500).json({ error: JSON.stringify(error) });
  }
});

// app.post('/login', async (req, res) => {
//   const { username, password } = req.body;

//   if (!username || !password) {
//     return res.status(400).send({ status: false, error: 'Missing required fields' });
//   }

//   try {
//     const user = await getUserByUsername(username);

//     if (!user) {
//       return res.status(401).send({ status: false, error: 'Invalid username or password' });
//     }

//     const passwordMatch = await bcrypt.compareSync(password, user.member_password);

//     if (!passwordMatch) {
//       return res.status(401).send({ status: false, error: 'Invalid username or password' });
//     }

//     res.status(200).send({ status: true, memberId: user.member_id, username: user.member_username });
//   } catch (error) {
//     console.error(error);
//     res.status(500).send({ status: false, error: 'Internal Server Error' });
//   }
// });'SELECT * FROM members WHERE member_username =

async function getUserByUsername(username) {
  return usePooledConnectionAsync(async (db) => {
    return await new Promise((resolve, reject) => {
      db.query(
        `
    SELECT 'admins' AS role, id AS user_id, username AS uze_name, password AS pazz FROM admins 
    WHERE username = ? and available = 1
    UNION
    SELECT 'farmers' AS role, id AS user_id, username AS uze_name, password AS pazz FROM farmers 
    WHERE username = ? and available = 1
    UNION
    SELECT 'members' AS role, id AS user_id, username AS uze_name, password AS pazz FROM members 
    WHERE username = ? and available = 1
    UNION
    SELECT 'providers' AS role, id AS user_id, username AS uze_name, password AS pazz FROM providers 
    WHERE username = ? and available = 1
    UNION
    SELECT 'tambons' AS role, id AS user_id, username AS uze_name, password AS pazz FROM tambons 
    WHERE username = ? and available = 1
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

// const dbQuery = util.promisify(db.query).bind(db);

// async function getUserByUsername(username) {
//   try {
//     const result = await dbQuery(`
//       SELECT 'admins' AS role, admin_id AS user_id, admin_user AS username FROM admins WHERE admin_user = ?
//       UNION
//       SELECT 'farmers' AS role, farmer_id AS user_id, farmer_username AS username FROM farmers WHERE farmer_username = ?
//       UNION
//       SELECT 'members' AS role, member_id AS user_id, member_username AS username FROM members WHERE member_username = ?
//       UNION
//       SELECT 'providers' AS role, provider_id AS user_id, prov_user AS username FROM providers WHERE prov_user = ?
//       UNION
//       SELECT 'tambon' AS role, tb_id AS user_id, tb_user AS username FROM tambon WHERE tb_user = ?
//       `, [username, username, username, username, username]);

//     return result.length > 0 ? result[0] : null;
//   } catch (error) {
//     throw error;
//   }
// }

app.get("/categories", (req, res) => {
  usePooledConnectionAsync(async (db) => {
    db.query("SELECT * FROM categories where available = 1", (err, result) => {
      if (err) {
        console.log(err);
        res.status(500).send({ exist: false, error: "Internal Server Error" });
      } else {
        res.json(result);
      }
    });
  });
});

app.delete("/categories", checkAdmin, async (req, res) => {
  const { category_id } = req.body;
  if (!category_id) {
    return res
      .status(400)
      .json({ success: false, message: "Missing required fields" });
  }

  await usePooledConnectionAsync(async (db) => {
    //soft delete
    const query = "UPDATE categories SET available = 0 WHERE category_id = ?";

    db.query(query, [category_id], (err, result) => {
      if (err) {
        console.error("Error deleting category:", err);
        return res
          .status(500)
          .json({ success: false, message: "Internal Server Error" });
      } else {
        return res
          .status(200)
          .json({ success: true, message: "Category deleted successfully" });
      }
    });
  });
});

app.post("/categories", checkAdmin, async (req, res) => {
  let { category_name, bgcolor } = req.body;
  if (!category_name || !bgcolor) {
    return res
      .status(400)
      .json({ success: false, message: "Missing required fields" });
  }
  //check if category_name is exist

  try {
    await usePooledConnectionAsync(async (db) => {
      let queryCategory_name =
        "SELECT * FROM categories WHERE category_name = ? and available = 1";
      let category_nameResult = await new Promise((resolve, reject) => {
        db.query(queryCategory_name, [category_name], (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });

      if (category_nameResult.length > 0) {
        return res.status(409).json({
          success: false,
          message: "หมวดหมู่ที่เพิ่มเข้ามามีอยู่ในระบบอยู่แล้ว",
        });
      }
      category_id = await new Promise((resolve, reject) => {
        db.query(
          "SELECT MAX(category_id) as maxId FROM categories",
          (err, result) => {
            if (err) {
              reject(err);
            } else {
              let nextId = "CAT0001";
              if (result[0].maxId) {
                const currentIdNumericPart = parseInt(
                  result[0].maxId.substring(3),
                  10
                );

                const nextNumericPart = currentIdNumericPart + 1;
                const paddedNextNumericPart = String(nextNumericPart).padStart(
                  4,
                  "0"
                );
                nextId = "CAT" + paddedNextNumericPart;
              }
              resolve(nextId);
            }
          }
        );
      });

      let query = `INSERT INTO categories (category_id, category_name, bgcolor, available) 
      VALUES (?, ?, ?, 1)`;

      db.query(query, [category_id, category_name, bgcolor], (err, result) => {
        if (err) {
          console.error("Error adding category:", err);
          return res
            .status(500)
            .json({ success: false, message: "Internal Server Error" });
        } else {
          return res
            .status(200)
            .json({ success: true, message: "Category added successfully" });
        }
      });
    });
  } catch (error) {
    console.error("Error adding category:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
});

app.put("/categories", checkAdmin, async (req, res) => {
  const { category_id, category_name, bgcolor } = req.body;
  if (!category_id || !category_name || !bgcolor) {
    return res
      .status(400)
      .json({ success: false, message: "Missing required fields" });
  }
  try {
    await usePooledConnectionAsync(async (db) => {
      let allcategories = await new Promise((resolve, reject) => {
        db.query(
          "SELECT * FROM categories WHERE available = 1",
          (err, result) => {
            if (err) {
              reject(err);
            } else {
              resolve(result);
            }
          }
        );
      });

      //find if category_name is exist
      let category_nameResult = allcategories.find(
        (category) => category.category_name === category_name
      );

      if (
        category_nameResult &&
        category_nameResult.category_id !== category_id
      ) {
        return res.status(409).json({
          success: false,
          message: "หมวดหมู่สินค้าที่แก้ไขเข้ามามีอยู่ในระบบอยู่แล้ว",
        });
      }

      db.query(
        "UPDATE categories SET category_name = ?, bgcolor = ? WHERE category_id = ?",
        [category_name, bgcolor, category_id],
        (err, result) => {
          if (err) {
            console.error("Error updating category:", err);
            return res
              .status(500)
              .json({ success: false, message: "Internal Server Error" });
          } else {
            return res.status(200).json({
              success: true,
              message: "Category updated successfully",
            });
          }
        }
      );
    });
  } catch (error) {
    console.error("Error updating category:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
});

app.get("/producttypes", async (req, res) => {
  await usePooledConnectionAsync(async (db) => {
    db.query("SELECT * FROM product_types", (err, result) => {
      if (err) {
        console.log(err);
        res.status(500).send({ exist: false, error: "Internal Server Error" });
      } else {
        res.json(result);
      }
    });
  });
});
app.get("/standardproducts", async (req, res) => {
  await usePooledConnectionAsync(async (db) => {
    db.query(
      "SELECT * FROM standard_products where available = 1",
      (err, result) => {
        if (err) {
          console.log(err);
          res
            .status(500)
            .send({ exist: false, error: "Internal Server Error" });
        } else {
          res.json(result);
        }
      }
    );
  });
});

async function checkIfEmailAndNameMatch(email) {
  return await usePooledConnectionAsync(async (db) => {
    return new Promise(async (resolve, reject) => {
      try {
        const query = `
    SELECT email FROM members
    UNION
    SELECT email FROM admins
    UNION
    SELECT email FROM farmers
    UNION
    SELECT email FROM providers
    UNION
    SELECT email FROM tambons;
    `;
        db.query(query, [email], (err, result) => {
          if (err) {
            console.error("Error checking email and name in database:", err);
            reject(err);
          } else {
            resolve(result.length > 0);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  });
}

app.post("/forgot", async (req, res) => {
  const { email } = req.body;

  try {
    const isMatch = await checkIfEmailAndNameMatch(email);

    if (isMatch) {
      const newPassword = generateRandomPassword();

      sendNewPasswordByEmail(email, newPassword);

      updatePasswordInDatabase(email, newPassword);

      res.json({ email: true });
    } else {
      res.json({ email: false });
    }
  } catch (error) {
    console.error("Error in forgot endpoint:", error);
    res.status(500).json({ email: "false" });
  }
});

function generateRandomPassword() {
  const length = 10;
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let newPassword = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    newPassword += charset[randomIndex];
  }
  return newPassword;
}

function sendNewPasswordByEmail(email, newPassword) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "thebestkasetnont@gmail.com",
      pass: "ggtf brgm brip mqvq",
    },
  });

  const mailOptions = {
    from: "thebestkasetnont@gmail.com",
    to: email,
    subject: "Your New Password",
    text: `Your new password is: ${newPassword}`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error("Error sending email:", error);
    } else {
      console.log("Email sent:", info.response);
    }
  });
}
function hashPassword(password) {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

async function updatePasswordInDatabase(email, newPassword) {
  try {
    await usePooledConnectionAsync(async (db) => {
      const hashedPassword = await hashPassword(newPassword);

      db.query(
        "UPDATE members SET password = ? WHERE email = ?",
        [hashedPassword, email],
        (err, result) => {
          if (err) {
            console.error("Error updating password in database:", err);
          } else {
            console.log("Password updated in database");
          }
        }
      );
    });
  } catch (error) {
    console.error("Error hashing password:", error);
  }
}

app.get("/standardproducts", async (req, res) => {
  await usePooledConnectionAsync(async (db) => {
    db.query("SELECT * FROM standard_products", (err, result) => {
      if (err) {
        console.log(err);
        res.status(500).send({ exist: false, error: "Internal Server Error" });
      } else {
        res.json(result);
      }
    });
  });
});
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = "./uploads";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    try {
      const originalname = file.originalname.split(".")[0];
      const extension = file.originalname.split(".")[1];
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, `${originalname}-${uniqueSuffix}.${extension}`);
    } catch (error) {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, `${uniqueSuffix}.jpg`);
      console.error("Error uploading file:", error);
    }
  },
});
async function getNextProductId() {
  return await usePooledConnectionAsync(async (db) => {
    return new Promise((resolve, reject) => {
      db.query(
        "SELECT MAX(product_id) as maxId FROM products",
        (err, result) => {
          if (err) {
            reject(err);
          } else {
            let nextId = "PROD000001";
            if (result[0].maxId) {
              const currentIdNumericPart = parseInt(
                result[0].maxId.substring(4),
                10
              );
              const nextNumericPart = currentIdNumericPart + 1;
              const paddedNextNumericPart = String(nextNumericPart).padStart(
                6,
                "0"
              );
              nextId = "PROD" + paddedNextNumericPart;
            }
            resolve(nextId);
          }
        }
      );
    });
  });
}
const upload = multer({ storage: storage });

const notifyFollowersAddproduct = async (
  productId,
  product_name,
  farmerId,
  farmerstorename
) => {
  return await usePooledConnectionAsync(async (db) => {
    try {
      const followers = await new Promise((resolve, reject) => {
        db.query(
          "SELECT member_id FROM followedbymember WHERE farmer_id = ?",
          [farmerId],
          (err, result) => {
            if (err) {
              reject(err);
            } else {
              resolve(result);
            }
          }
        );
      });
      followers.forEach(async ({ member_id }, index) => {
        await createNotification(
          farmerId,
          member_id,
          `เกษตรกรร้านค้า ${farmerstorename} ได้เพิ่มสินค้าใหม่ ${product_name}`,
          `/shop/${farmerstorename}/${productId}`,
          "เพิ่มสินค้า",
          index
        );
      });
    } catch (error) {
      console.error("Error notifying followers:", error);
    }
  });
};

app.get("/notification", async (req, res) => {
  const token = req.headers.authorization
    ? req.headers.authorization.split(" ")[1]
    : null;
  try {
    const decoded = jwt.verify(token, secretKey);
    const userId = decoded.ID;
    const notifications = await usePooledConnectionAsync(async (db) => {
      return await new Promise((resolve, reject) => {
        db.query(
          "SELECT * FROM notification WHERE recipient_id = ? and is_unread = 1",
          [userId],
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
    return res.status(200).json(notifications);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/notification", async (req, res) => {
  const { id } = req.body;
  const token = req.headers.authorization
    ? req.headers.authorization.split(" ")[1]
    : null;
  try {
    let decoded = jwt.verify(token, secretKey);
    const userId = decoded.ID;
    await usePooledConnectionAsync(async (db) => {
      await new Promise((resolve, reject) => {
        //delete notification
        db.query(
          "Delete FROM notification WHERE id = ? and recipient_id = ? and is_unread = 1",
          [id, userId],
          (err, result) => {
            if (err) {
              console.log(err);
              reject(err);
            } else {
              resolve(result);
            }
          }
        );
      });
    });
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

const generateCertificate = async (
  standard_id,
  product_id,
  farmer_id,
  index = 0
) => {
  return await usePooledConnectionAsync(async (db) => {
    try {
      let certId = await new Promise(async (resolve, reject) => {
        db.query(
          "SELECT MAX(id) as maxId FROM certificate_link_farmer",
          (err, result) => {
            if (err) {
              reject(err);
            } else {
              let nextId = "CERT000001";
              if (result[0].maxId) {
                const currentId = result[0].maxId;
                const numericPart =
                  parseInt(currentId.substring(4), 10) + 1 + index;

                nextId = "CERT" + numericPart.toString().padStart(6, "0");
              }
              resolve(nextId);
            }
          }
        );
      });

      let query = `INSERT INTO certificate_link_farmer (id, standard_id, product_id, farmer_id, status)
        VALUES (?, ?, ?, ?, "pending")
      `;
      db.query(
        query,
        [certId, standard_id, product_id, farmer_id],
        (err, result) => {
          if (err) {
            console.error("Error adding certificate:", err);
          } else {
            console.log("Certificate added successfully");
          }
        }
      );
      return certId;
    } catch (error) {
      throw error;
    }
  });
};

app.post("/addproduct", checkFarmer, async (req, res) => {
  let {
    product_id,
    product_name,
    category_id,
    product_description,
    selectedType,
    price,
    unit,
    stock,
    selectedStatus,
    date_reserve_start,
    date_reserve_end,
    product_image,
    product_video,
    additional_images,
    certificate,
    weight,
    period,
    forecastDate,
  } = req.body;
  const token = req.headers.authorization
    ? req.headers.authorization.split(" ")[1]
    : null;
  try {
    await usePooledConnectionAsync(async (db) => {
      const decoded = jwt.verify(token, secretKey);
      let farmerId = null;
      if (decoded.role == "farmers") {
        farmerId = decoded.ID;
      } else {
        farmerId = await new Promise((resolve, reject) => {
          db.query(
            "SELECT ID FROM farmers WHERE username = ? and available = 1",
            [req.body.username],
            (err, result) => {
              if (err) {
                reject(err);
              } else {
                if (result.length > 0) {
                  resolve(result[0].ID);
                } else {
                  reject("Farmer not found");
                }
              }
            }
          );
        });
      }

      let havePaymentOrQrcode = await new Promise((resolve, reject) => {
        db.query(
          "SELECT payment, qrcode FROM farmers WHERE id = ? and available = 1",
          [farmerId],
          (err, result) => {
            if (err) {
              reject(err);
            } else {
              resolve(result[0]);
            }
          }
        );
      });

      if (!havePaymentOrQrcode.payment && !havePaymentOrQrcode.qrcode) {
        return res.status(400).send({
          success: false,
          message: "กรุณาเพิ่มข้อมูลการชำระเงินหรือรูป Qr code ก่อนเพิ่มสินค้า",
        });
      }
      if (product_id) {
        JSON.parse(certificate).forEach(async (cert, index) => {
          let certAlreadyExist = await new Promise((resolve, reject) => {
            db.query(
              "SELECT * FROM certificate_link_farmer WHERE standard_id = ? and product_id = ? and farmer_id = ?",
              [cert.standard_id, product_id, farmerId],
              (err, result) => {
                if (err) {
                  reject(err);
                } else {
                  resolve(result.length > 0);
                }
              }
            );
          });
          if (!certAlreadyExist) {
            await generateCertificate(
              cert.standard_id,
              product_id,
              farmerId,
              index
            );
          }
        });
        const query = `UPDATE products SET selectedStatus = ?, date_reserve_start = ?, date_reserve_end = ?, product_name = ?,
         product_description = ?,category_id = ?, stock = ?, price = ?, weight = ?, unit = ?, product_image = ?, product_video = ?,
          additional_image = ?, selectedType = ?, period = ?, forecastDate = ?, last_modified = NOW() WHERE product_id = ? and farmer_id = ?`;
        let result = await new Promise((resolve, reject) => {
          db.query(
            query,
            [
              selectedStatus,
              date_reserve_start,
              date_reserve_end,
              product_name,
              product_description,
              category_id,
              stock,
              price,
              weight,
              unit,
              product_image,
              product_video,
              additional_images,
              selectedType,
              period,
              forecastDate,
              product_id,
              farmerId,
            ],
            (err, result) => {
              if (err) {
                console.error("Error updating product:", err);
                reject(err);
              } else {
                resolve(result);
              }
            }
          );
        });
        if (result.affectedRows > 0) {
          return res
            .status(200)
            .send({ success: true, message: "Product updated successfully" });
        }
      }
      const nextProductId = await getNextProductId();
      JSON.parse(certificate).forEach(async (cert, index) => {
        await generateCertificate(cert, nextProductId, farmerId, index);
      });
      const query = `
        INSERT INTO products (selectedStatus, date_reserve_start, date_reserve_end, product_id, farmer_id,
           product_name, product_description, category_id, stock, price, weight, unit, product_image, 
           product_video, additional_image, selectedType, period, forecastDate, last_modified)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `;
      db.query(
        query,
        [
          selectedStatus,
          date_reserve_start,
          date_reserve_end,
          nextProductId,
          farmerId,
          product_name,
          product_description,
          category_id,
          stock,
          price,
          weight,
          unit,
          product_image,
          product_video,
          additional_images,
          selectedType,
          period,
          forecastDate,
        ],
        async (err, result) => {
          if (err) {
            console.error("Error adding product:", err);
            return res
              .status(500)
              .send({ success: false, message: JSON.stringify(err) });
          }
          // find farmerstorename by farmer_id
          let farmerstorename = await new Promise((resolve, reject) => {
            db.query(
              "SELECT farmerstorename FROM farmers WHERE id = ?",
              [farmerId],
              (err, result) => {
                if (err) {
                  console.error("Error finding farmerstorename:", err);
                  reject(err);
                }
                resolve(result[0].farmerstorename);
              }
            );
          });
          notifyFollowersAddproduct(
            nextProductId,
            product_name,
            farmerId,
            farmerstorename
          );
          return res
            .status(200)
            .send({ success: true, message: "Product added successfully" });
        }
      );
    });
  } catch (error) {
    console.error("Error adding product:", error);
    return res
      .status(500)
      .send({ success: false, message: JSON.stringify(error) });
  }
});
// app.get("/getproduct/:urlToShorten(*)", (req, res) => {
//   console.log(req.originalUrl);
//   console.log(req.params.urlToShorten);
//   return res.status(200).send({ success: true });
// });
app.get("/getimage/:image", (req, res) => {
  const image = req.params.image;
  res.sendFile(path.join(__dirname, "uploads", image));
});

app.get("/getproduct/:shopname/:product_id", async (req, res) => {
  const { product_id, shopname } = req.params;
  await usePooledConnectionAsync(async (db) => {
    db.query(
      `SELECT p.*, f.firstname, f.lastname, f.shippingcost, f.address, f.lat, f.lng,
       f.facebooklink, f.lineid, f.lastLogin FROM products p LEFT JOIN farmers f ON p.farmer_id = f.id 
       WHERE p.product_id = ? and f.farmerstorename = ? and p.available = 1 and f.available = 1;`,
      [product_id, shopname],
      async (err, result) => {
        if (err) {
          console.log(err);
          res
            .status(500)
            .send({ exist: false, error: "Internal Server Error" });
        } else {
          let validCert = await new Promise((resolve, reject) => {
            db.query(
              `SELECT standard_id, status FROM certificate_link_farmer WHERE product_id = ? and farmer_id = ?`,
              [product_id, result[0].farmer_id],
              (err, result) => {
                if (err) {
                  throw err;
                } else {
                  resolve(result);
                }
              }
            );
          });
          result = {
            ...result[0],
            certificate: JSON.stringify(validCert),
          };
          res.header("charset", "utf-8").json(result);
        }
      }
    );
  });
});

app.get("/getproducts", async (req, res) => {
  let {
    search,
    category,
    page,
    sort,
    order,
    perPage,
    groupby,
    farmerstorename: shopname,
  } = req.query;
  if (page < 1) {
    page = 1;
  }
  page -= 1;
  if (!perPage) {
    perPage = 40;
  }
  let queryMaxPage = `SELECT COUNT(*) as maxPage FROM products where available = 1 and ${
    search !== "" ? `${"product_name LIKE '%" + search + "%' AND"}` : ""
  } ${
    shopname
      ? `farmer_id = (select id from farmers where farmerstorename = '${shopname}' and available = 1) and`
      : ""
  } category_id = '${category}'`;
  let query = `SELECT p.*, f.lat, f.lng, f.farmerstorename, f.shippingcost, f.lastLogin FROM products p 
  INNER JOIN farmers f ON p.farmer_id = f.id where p.available = 1 and f.available = 1 and ${
    search !== "" ? `${"product_name LIKE '%" + search + "%' AND"}` : ""
  } 
  ${
    shopname
      ? `farmer_id = (select id from farmers where farmerstorename = '${shopname}' and  available = 1) and`
      : ""
  } category_id = '${category}' ${
    groupby ? "group by p.farmer_id" : ""
  } ORDER BY ${sort} ${order} LIMIT ${perPage} OFFSET ${page * perPage}`;
  if (category == "") {
    queryMaxPage = `SELECT COUNT(*) as maxPage FROM products where available = 1 ${
      search !== "" ? `${"and product_name LIKE '%" + search + "%'"}` : ""
    } ${
      shopname
        ? `and farmer_id = (select id from farmers where farmerstorename = '${shopname}' and available = 1) `
        : ""
    }`;
    query = `SELECT p.*, f.lat, f.lng, f.farmerstorename, f.shippingcost, f.lastLogin FROM products p 
    INNER JOIN farmers f ON p.farmer_id = f.id where p.available = 1 and f.available = 1  ${
      search !== "" ? `${"and product_name LIKE '%" + search + "%'"}` : ""
    } ${groupby ? "group by p.farmer_id" : ""} ${
      shopname
        ? `and farmer_id = (select id from farmers where farmerstorename = '${shopname}' and available = 1)`
        : ""
    }  
    ORDER BY ${sort} ${order} LIMIT ${perPage} OFFSET ${page * perPage} `;
  }
  await usePooledConnectionAsync(async (db) => {
    let AllPage = await new Promise((resolve, reject) => {
      db.query(queryMaxPage, (err, result) => {
        if (err) {
          console.log(err);
          reject(err);
        } else {
          resolve(result[0].maxPage);
        }
      });
    });
    db.query(query, (err, result) => {
      if (err) {
        console.log(err);
        res.status(500).send({ exist: false, error: JSON.stringify(err) });
      } else {
        res.json({
          products: result,
          maxPage:
            AllPage % perPage === 0
              ? AllPage / perPage
              : Math.floor(AllPage / perPage) + 1,
        });
      }
    });
  });
});

app.get("/getpayment/:id", async (req, res) => {
  await usePooledConnectionAsync(async (db) => {
    const id = req.params.id;
    db.query(
      "SELECT payment , qrcode FROM farmers WHERE id = (select farmer_id from products where product_id = ?)",
      [id],
      (err, result) => {
        if (err) {
          console.log(err);
          res
            .status(500)
            .send({ exist: false, error: "Internal Server Error" });
        } else {
          res.json(result[0]);
        }
      }
    );
  });
});

app.delete("/deleteproduct/:id", checkFarmer, async (req, res) => {
  const { id } = req.params;
  const token = req.headers.authorization
    ? req.headers.authorization.split(" ")[1]
    : null;
  await usePooledConnectionAsync(async (db) => {
    //soft delete
    const decoded = jwt.verify(token, secretKey);
    let farmerId;
    if (decoded.role === "farmers") {
      farmerId = decoded.ID;
    } else {
      farmerId = await new Promise((resolve, reject) => {
        db.query(
          "SELECT id FROM farmers WHERE username = ? and available = 1",
          [req.body.username],
          (err, result) => {
            if (err) {
              return res
                .status(500)
                .send({ exist: false, error: JSON.stringify(err) });
            } else {
              resolve(result[0].id);
            }
          }
        );
      });
    }
    db.query(
      `UPDATE products SET available = 0 WHERE product_id = "${id}" and farmer_id = "${farmerId}"`,
      (err, result) => {
        if (err) {
          console.log(err);
          res.status(500).send({ exist: false, error: JSON.stringify(err) });
        } else {
          res.json({
            success: true,
            id,
            farmerId,
            result: JSON.stringify(result),
          });
        }
      }
    );
  });
});

app.get("/updateview/:id", async (req, res) => {
  const { id } = req.params;
  // update view_count + 1
  await usePooledConnectionAsync(async (db) => {
    db.query(
      "UPDATE products SET view_count = view_count + 1 WHERE product_id = ?",
      [id],
      (err, result) => {
        if (err) {
          console.log(err);
          res
            .status(500)
            .send({ exist: false, error: "Internal Server Error" });
        } else {
          res.json({ success: true });
        }
      }
    );
  });
});

app.get("/myproducts/:username", async (req, res) => {
  await usePooledConnectionAsync(async (db) => {
    const { username } = req.params;
    // db.query(
    //   "SELECT p.product_id, p.product_image, p.product_description, p.product_name, p.selectedType, p.last_modified, p.price, p.view_count, p.category_id,c.category_name, f.farmerstorename FROM products p left join farmers f on p.farmer_id = f.id LEFT JOIN categories c on p.category_id = c.category_id WHERE p.farmer_id = (select id from farmers where username = ?) and p.available = 1;",
    //   [username],
    //   (err, result) => {
    //     if (err) {
    //       console.log(err);
    //       res
    //         .status(500)
    //         .send({ exist: false, error: "Internal Server Error" });
    //     } else {

    //       res.json(result);
    //     }
    //   }
    // );
    db.query(
      "SELECT p.product_id, p.product_image, p.product_description, p.product_name, p.selectedType,p.certificate, p.last_modified, p.price, p.view_count, p.category_id,c.category_name, f.farmerstorename FROM products p left join farmers f on p.farmer_id = f.id LEFT JOIN categories c on p.category_id = c.category_id WHERE p.farmer_id = (select id from farmers where username = ? and available = 1) and p.available = 1;",
      [username],
      async (err, result) => {
        if (err) {
          console.log(err);
          res.status(500).send({ exist: false, error: JSON.stringify(err) });
        } else {
          try {
            // let results = await Promise.all(
            //   result.map(async (product) => {
            //     let certificate = JSON.parse(product.certificate);
            //     let allStandardName = await Promise.all(
            //       certificate.map(async (cert, index) => {
            //         try {
            //           let standardName = await new Promise(
            //             (resolve, reject) => {
            //               db.query(
            //                 "SELECT sn.standard_name FROM certificate_link_farmer clf join standard_products sn on clf.standard_id = sn.standard_id WHERE clf.id = ?",
            //                 [cert],
            //                 (err, result) => {
            //                   if (err) {
            //                     console.log(err);
            //                     reject(err);
            //                   } else {
            //                     resolve(result[0].standard_name);
            //                   }
            //                 }
            //               );
            //             }
            //           );
            //           return standardName;
            //         } catch (error) {
            //           console.error(error);
            //           throw error;
            //         }
            //       })
            //     );
            //     return { ...product, certification: allStandardName };
            //   })
            // );
            // res.json({ result: results });
            return res.json({ result: result });
          } catch (error) {
            console.error(error);
            return res
              .status(500)
              .send({ exist: false, error: "Internal Server Error" });
          }
        }
      }
    );
  });
});

app.get("/getinfo", async (req, res) => {
  const token = req.headers.authorization
    ? req.headers.authorization.split(" ")[1]
    : null;
  if (!token) {
    return res.status(400).json({ error: "Token not provided" });
  }
  try {
    const decoded = jwt.verify(token, secretKey);
    const { username, role } = decoded;
    var query;
    if (role === "farmers") {
      query = `SELECT farmerstorename, username, email, firstname, lastname, phone, address, province, amphure, tambon, payment,facebooklink, lineid , lat, lng, zipcode, shippingcost from ${role} where username = "${username}"`;
    } else if (role === "tambons") {
      query = `SELECT username, email, firstname, lastname, phone, amphure from ${role} where username = "${username}"`;
    } else if (role === "members") {
      query = `SELECT username, email, firstname, lastname, phone, address from ${role} where username = "${username}"`;
    } else {
      query = `SELECT username, email, firstname, lastname, phone from ${role} where username = "${username}"`;
    }
    await usePooledConnectionAsync(async (db) => {
      db.query(query, (err, result) => {
        if (err) {
          console.log(err);
          res.status(500).send({ exist: false, error: JSON.stringify(err) });
        } else {
          res.json(result[0]);
        }
      });
    });

    return res.status(200);
  } catch (error) {
    console.error("Error decoding token:5", error.message);
    return res.status(500).json({ error: JSON.stringify(error) });
  }
});

app.post(
  "/updateinfo",
  upload.fields([{ name: "image", maxCount: 1 }]),
  async (req, res) => {
    const token = req.headers.authorization
      ? req.headers.authorization.split(" ")[1]
      : null;
    if (!token) {
      return res.status(400).json({ error: "Token not provided" });
    }
    let {
      email = null,
      firstname = null,
      lastname = null,
      phone = null,
      address = null,
      facebooklink = null,
      lineid = null,
      lat = null,
      lng = null,
      zipcode = null,
      farmerstorename = null,
      payment = null,
      province = null,
      amphure = null,
      tambon = null,
      shippingcost = null,
    } = req.body;

    // if (!firstname || !lastname || !phone) {
    //   return res
    //     .status(400)
    //     .json({ success: false, message: "Missing required fields" });
    // }

    try {
      let decoded = jwt.verify(token, secretKey);
      const { username, role } = decoded;
      let originalAmphure = amphure;
      if (role === "farmers") {
        if (!amphure || !lat || !lng) {
          return res
            .status(400)
            .json({ success: false, message: "Missing required fields2" });
        }
        // validate if lat lng is number

        if (isNaN(lat) || isNaN(lng)) {
          return res
            .status(400)
            .json({ success: false, message: "Invalid lat or lng" });
        }
        let pathName;
        if (req.files && req.files.image) {
          let image = req.files.image[0].filename;
          pathName = "/uploads/" + image;
        }
        pathName = pathName ? `,qrcode = "${pathName}"` : "";
        email = email ? `,email = "${email}"` : "";
        firstname = firstname ? `,firstname = "${firstname}"` : "";
        lastname = lastname ? `,lastname = "${lastname}"` : "";
        phone = phone ? `,phone = "${phone}"` : "";
        farmerstorename = farmerstorename
          ? `,farmerstorename = "${farmerstorename}"`
          : "";
        address = address ? `,address = "${address}"` : "";
        lat = lat ? `lat = "${lat}"` : "";
        lng = lng ? `lng = "${lng}"` : "";
        facebooklink = facebooklink ? `,facebooklink = "${facebooklink}"` : "";
        lineid = lineid ? `,lineid = "${lineid}"` : "";
        zipcode = zipcode ? `,zipcode = "${zipcode}"` : "";
        payment = payment ? `,payment = "${payment}"` : "";
        province = province
          ? `,province = "${province}"`
          : `,province = ${province}`;
        amphure = amphure ? `amphure = "${amphure}"` : "";
        tambon = tambon ? `,tambon = "${tambon}"` : "";
        shippingcost = shippingcost
          ? `,shippingcost='${JSON.stringify(JSON.parse(shippingcost))}'`
          : `,shippingcost='${JSON.stringify([{ weight: 0, price: 0 }])}'`;
        query = `UPDATE ${role} SET ${amphure}, ${lat}, ${lng} ${email} ${firstname} ${lastname} ${farmerstorename} ${phone} ${address} ${facebooklink} ${lineid} ${zipcode} ${payment} ${province} ${tambon} ${shippingcost} ${pathName} WHERE username = "${username}"`;
      } else if (role === "members") {
        if (!firstname || !lastname || !phone || !email) {
          return res
            .status(400)
            .json({ success: false, message: "Missing required fields" });
        }
        email = email ? `email = "${email}"` : "";
        firstname = firstname ? `firstname = "${firstname}"` : "";
        lastname = lastname ? `lastname = "${lastname}"` : "";
        phone = phone ? `phone = "${phone}"` : "";
        address = address ? `,address = "${address}"` : "";
        query = `UPDATE ${role} SET ${email}, ${firstname}, ${lastname}, ${phone} ${address} WHERE username = "${username}"`;
      } else if (role === "tambons") {
        email = email ? `,email = "${email}"` : "";
        firstname = firstname ? `firstname = "${firstname}"` : "";
        lastname = lastname ? `lastname = "${lastname}"` : "";
        amphure = amphure ? `,amphure = "${amphure}"` : "";
        phone = phone ? `phone = "${phone}"` : "";
        address = address ? `,address = "${address}"` : "";
        query = `UPDATE ${role} SET ${firstname}, ${lastname}, ${phone} ${address} ${amphure} ${email} WHERE username = "${username}"`;
      } else {
        email = email ? `email = "${email}"` : "";
        firstname = firstname ? `firstname = "${firstname}"` : "";
        lastname = lastname ? `lastname = "${lastname}"` : "";
        phone = phone ? `phone = "${phone}"` : "";
        query = `UPDATE ${role} SET ${email}, ${firstname}, ${lastname}, ${phone} WHERE username = "${username}"`;
      }
      await usePooledConnectionAsync(async (db) => {
        db.query(query, (err, result) => {
          if (err) {
            console.log(err);
            return res
              .status(500)
              .send({ exist: false, error: "Internal Server Error" });
          }
        });
      });
      let option = {
        username: decoded.username,
        ID: decoded.ID,
        role: decoded.role,
      };
      if (role === "tambons") {
        option = {
          ...option,
          amphure: originalAmphure,
        };
      }
      let signedToken = jwt.sign(option, secretKey, {
        expiresIn: "15d",
      });

      return res.status(200).send({ success: true, newToken: signedToken });
    } catch (error) {
      console.error("Error decoding token:6", error.message);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

app.post(
  "/updateinfoadmin",
  upload.none(),
  checkAdminTambon,
  async (req, res) => {
    let {
      email = null,
      firstname = null,
      lastname = null,
      phone = null,
      address = null,
      facebooklink = null,
      lineid = null,
      lat = null,
      lng = null,
      zipcode = null,
      farmerstorename = null,
      province = null,
      amphure = null,
      tambon = null,
      username = null,
      payment = null,
      role = null,
      shippingcost = null,
    } = req.body;
    if (!role || !username) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields1" });
    }
    try {
      const token = req.headers.authorization
        ? req.headers.authorization.split(" ")[1]
        : null;
      const decoded = jwt.verify(token, secretKey);
      var query;
      if (role === "farmers" || decoded.role === "tambons") {
        if (!amphure || !lat || !lng) {
          return res
            .status(400)
            .json({ success: false, message: "Missing required fields2" });
        }
        let pathName;
        if (req.files && req.files.image) {
          let image = req.files.image[0].filename;
          pathName = "/uploads/" + image;
        }
        pathName = pathName ? `,qrcode = "${pathName}"` : "";
        email = email ? `,email = "${email}"` : "";
        firstname = firstname ? `,firstname = "${firstname}"` : "";
        lastname = lastname ? `,lastname = "${lastname}"` : "";
        phone = phone ? `,phone = "${phone}"` : "";
        farmerstorename = farmerstorename
          ? `,farmerstorename = "${farmerstorename}"`
          : "";
        address = address ? `,address = "${address}"` : "";
        lat = lat ? `lat = "${lat}"` : "";
        lng = lng ? `lng = "${lng}"` : "";
        facebooklink = facebooklink ? `,facebooklink = "${facebooklink}"` : "";
        lineid = lineid ? `,lineid = "${lineid}"` : "";
        zipcode = zipcode ? `,zipcode = "${zipcode}"` : "";
        payment = payment ? `,payment = "${payment}"` : "";
        province = province
          ? `,province = "${province}"`
          : `,province = ${province}`;
        amphure = amphure ? `amphure = "${amphure}"` : "";
        tambon = tambon ? `,tambon = "${tambon}"` : "";
        shippingcost = shippingcost
          ? `,shippingcost='${JSON.stringify(JSON.parse(shippingcost))}'`
          : `,shippingcost='${JSON.stringify([{ weight: 0, price: 0 }])}'`;
        query = `UPDATE ${role} SET ${amphure}, ${lat}, ${lng} ${email} ${firstname} ${lastname} ${farmerstorename} ${phone} ${address} ${facebooklink} ${lineid} ${zipcode} ${payment} ${province} ${tambon} ${shippingcost} ${pathName} WHERE username = "${username}"`;
      } else if (role === "tambons") {
        if (!amphure) {
          return res
            .status(400)
            .json({ success: false, message: "Missing required fields3" });
        }
        email = email ? `,email = "${email}"` : "";
        firstname = firstname ? `,firstname = "${firstname}"` : "";
        lastname = lastname ? `,lastname = "${lastname}"` : "";
        amphure = amphure ? `amphure = "${amphure}"` : "";
        phone = phone ? `,phone = "${phone}"` : "";
        address = address ? `,address = "${address}"` : "";
        query = `UPDATE ${role} SET ${amphure} ${email} ${firstname} ${lastname} ${phone} ${address} 
       WHERE username = "${username}"`;
      } else if (role === "members") {
        if (!email || !firstname || !lastname || !phone) {
          return res
            .status(400)
            .json({ success: false, message: "Missing required fields4" });
        }
        email = email ? `email = "${email}"` : "";
        firstname = firstname ? `firstname = "${firstname}"` : "";
        lastname = lastname ? `lastname = "${lastname}"` : "";
        phone = phone ? `phone = "${phone}"` : "";
        address = address ? `,address = "${address}"` : "";
        query = `UPDATE ${role} SET ${email}, ${firstname}, ${lastname}, ${phone} ${address} 
      WHERE username = "${username}"`;
      } else {
        email = email ? `email = "${email}"` : "";
        firstname = firstname ? `firstname = "${firstname}"` : "";
        lastname = lastname ? `lastname = "${lastname}"` : "";
        phone = phone ? `phone = "${phone}"` : "";
        query = `UPDATE ${role} SET ${email}, ${firstname}, ${lastname}, ${phone} 
      WHERE username = "${username}"`;
      }
      await usePooledConnectionAsync(async (db) => {
        db.query(query, (err, result) => {
          if (err) {
            console.log(err);
            res
              .status(500)
              .send({ exist: false, error: "Internal Server Error" });
          } else {
            res.json(result[0]);
          }
        });
      });
      return res.status(200);
    } catch (error) {
      console.error("Error updating user:", error);
      res
        .status(500)
        .json({ success: false, message: "Internal Server Error" });
    }
  }
);

app.get(
  "/getuseradmin/:role/:username",
  checkTambonProvider,
  async (req, res) => {
    const { role, username } = req.params;
    var query;
    try {
      const token = req.headers.authorization
        ? req.headers.authorization.split(" ")[1]
        : null;
      const decoded = jwt.verify(token, secretKey);
      if (
        role === "farmers" ||
        decoded.role === "tamboons" ||
        decoded.role === "providers"
      ) {
        query = `SELECT farmerstorename, username, email, firstname, lastname, phone, address, province, amphure, tambon, facebooklink, lineid , lat, lng, zipcode, shippingcost, createAt, lastLogin from ${role} where username = "${username}" and available = 1`;
      } else if (role === "members") {
        query = `SELECT username, email, firstname, lastname, phone, address from ${role} where username = "${username}"`;
      } else {
        query = `SELECT username, email, firstname, lastname, phone from ${role} where username = "${username}"`;
      }
      await usePooledConnectionAsync(async (db) => {
        db.query(query, (err, result) => {
          if (err) {
            console.log(err);
            res
              .status(500)
              .send({ exist: false, error: "Internal Server Error" });
          } else {
            res.json(result[0]);
          }
        });
      });

      return res.status(200);
    } catch (error) {
      console.error("Error fetching user:", error.message);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

// app.post('/checkout', async (req, res) => {
//   const { cartList } = req.body;
//   if (!cartList || !Array.isArray(cartList) || cartList.length === 0) {
//     return res.status(400).json({ success: false, message: 'Empty or invalid cart data' });
//   }

//   const failedProducts = [];

//   for (const item of cartList) {
//     try {
//       const { product_id, amount } = item;
//       const getProductQuery = 'SELECT stock FROM products WHERE product_id = ?';
//       const [product] = await new Promise((resolve, reject) => {
//         db.query(getProductQuery, [product_id], (err, result) => {
//           if (err) {
//             reject(err);
//           } else {
//             resolve(result);
//           }
//         });
//       });

//       if (!product || product.length === 0) {
//         console.error(`Product ID ${product_id} not found`);
//         failedProducts.push({ product_id, error: `Product ID ${product_id} not found` });
//         continue;
//       }

//       const currentStock = product.stock;
//       if (amount > currentStock) {
//         console.error(`Insufficient stock for product ID ${product_id}`);
//         failedProducts.push({ product_id, error: `Insufficient stock for product ID ${product_id}` });
//       }
//     } catch (error) {
//       console.error('Error updating stock:', error);
//     }
//   }

//   if (failedProducts.length > 0) {
//     return res.status(400).json({ success: false, message: 'Some products are not available', failedProducts });
//   } else {
//     return res.status(200).json({ success: true, message: 'All products are available' });
//   }
// });

app.post(
  "/checkout",
  checkActivated,
  upload.fields([{ name: "image", maxCount: 1 }]),
  async (req, res) => {
    let { cartList, shippingcost } = req.body;
    var SUMITNOW = 0;
    try {
      await usePooledConnectionAsync(async (db) => {
        cartList = JSON.parse(cartList);
        if (!cartList || !Array.isArray(cartList) || cartList.length === 0) {
          return res
            .status(400)
            .json({ success: false, message: "Empty or invalid cart data" });
        }
        const token = req.headers.authorization
          ? req.headers.authorization.split(" ")[1]
          : null;
        const decoded = jwt.verify(token, secretKey);
        await new Promise((resolve, reject) => {
          db.beginTransaction((err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        let idoffarmer;
        const getAddress = "SELECT address FROM members WHERE id = ?";
        const memberaddress = await new Promise((resolve, reject) => {
          db.query(getAddress, [decoded.ID], (err, result) => {
            if (err) {
              reject(err);
            } else {
              resolve(result);
            }
          });
        });
        const productSlipFile = req.files["image"]
          ? req.files["image"][0]
          : null;
        const productSlipPath = productSlipFile
          ? `./uploads/${productSlipFile.filename}`
          : null;
        let address;
        if (req.body.address) {
          address = req.body.address;
        } else {
          address = memberaddress[0].address;
        }

        async function getNextORDID() {
          return new Promise((resolve, reject) => {
            db.query(
              "SELECT MAX(id) as maxId FROM order_sumary",
              (err, result) => {
                if (err) {
                  reject(err);
                } else {
                  let ORDNXT = "ORD00001";
                  if (result[0].maxId) {
                    const currentId = result[0].maxId;

                    const numericPart =
                      parseInt(currentId.substring(3), 10) + 1;

                    ORDNXT = "ORD" + numericPart.toString().padStart(5, "0");
                  }
                  resolve(ORDNXT);
                }
              }
            );
          });
        }
        const ORDNXT = await getNextORDID();
        const insertOrderVB = `INSERT INTO order_sumary (id,status,total_amount,member_id,
            transaction_confirm,address,shippingcost,date_buys) 
          VALUES (?,?,?,?,?,?,?,NOW())`;
        await new Promise((resolve, reject) => {
          db.query(
            insertOrderVB,
            [
              ORDNXT,
              "pending",
              SUMITNOW,
              decoded.ID,
              productSlipPath,
              address,
              shippingcost,
            ],
            (err, result) => {
              if (err) {
                reject(err);
              } else {
                resolve(result);
              }
            }
          );
        });
        for (const item of cartList) {
          const { product_id, amount } = item;

          const getProductQuery =
            "SELECT stock, farmer_id, selectedType FROM products WHERE product_id = ?";

          const [product] = await new Promise((resolve, reject) => {
            db.query(getProductQuery, [product_id], (err, result) => {
              if (err) {
                reject(err);
              } else {
                resolve(result);
              }
            });
          });
          if (!idoffarmer) {
            idoffarmer = product.farmer_id;
          } else if (idoffarmer != product.farmer_id) {
            return res.status(400).json({
              success: false,
              message: "Cart items must be from the same farmer",
            });
          }
          if (product.selectedType != "สินค้าจัดส่งพัสดุ") {
            return res
              .status(400)
              .json({ success: false, message: "Order Has Not avalable" });
          }
          const getProductPriceQuery =
            "SELECT price FROM products WHERE product_id = ?";
          const [result] = await new Promise((resolve, reject) => {
            db.query(getProductPriceQuery, [product_id], (err, result) => {
              if (err) {
                reject(err);
              } else {
                if (result.length === 0) {
                  reject(new Error(`Product ID ${product_id} not found`));
                } else {
                  resolve(result);
                }
              }
            });
          });
          const price = result.price;
          const totalProductPrice = price * amount;
          SUMITNOW = SUMITNOW + totalProductPrice;
          if (!product || product.length === 0) {
            console.error(`Product ID ${product_id} not found`);
            return res
              .status(400)
              .send({ error: `Product ID ${product_id} not found` });
          }
          if (amount <= 0) {
            console.error(`Insufficient stock for product ID ${product_id}`);
            return res.status(400).send({ error: `NOT TRUE` });
          }
          const currentStock = product.stock; // Corrected to access the stock property
          if (amount > currentStock) {
            console.error(`Insufficient stock for product ID ${product_id}`);
            return res.status(400).send({
              error: `Insufficient stock for product ID ${product_id}`,
            });
          }
          const newStock = currentStock - amount;
          const updateStockQuery =
            "UPDATE products SET stock = ? WHERE product_id = ?";
          await new Promise((resolve, reject) => {
            db.query(
              updateStockQuery,
              [newStock, product_id],
              (err, result) => {
                if (err) {
                  reject(err);
                } else {
                  resolve(result);
                }
              }
            );
          });
          async function getNextItemId() {
            return new Promise((resolve, reject) => {
              db.query(
                "SELECT MAX(item_id) as maxId FROM order_items",
                (err, result) => {
                  if (err) {
                    reject(err);
                  } else {
                    let nextId = "ITEM00001";
                    if (result[0].maxId) {
                      const currentId = result[0].maxId;
                      const numericPart =
                        parseInt(currentId.substring(4), 10) + 1;
                      nextId = "ITEM" + numericPart.toString().padStart(5, "0");
                    }
                    resolve(nextId);
                  }
                }
              );
            });
          }
          const nextitemId = await getNextItemId();
          const insertOrderItemQuery = `INSERT INTO order_items (item_id,product_id,order_id,price, quantity) 
            VALUES (?,?,?,?,?)`;
          await new Promise((resolve, reject) => {
            db.query(
              insertOrderItemQuery,
              [nextitemId, product_id, ORDNXT, totalProductPrice, amount],
              (err, result) => {
                if (err) {
                  reject(err);
                } else {
                  resolve(result);
                }
              }
            );
          });
        }
        const updateSUM =
          "UPDATE order_sumary SET total_amount = ? WHERE id = ?";
        await new Promise((resolve, reject) => {
          db.query(updateSUM, [SUMITNOW, ORDNXT], (err, result) => {
            if (err) {
              reject(err);
            } else {
              resolve(result);
            }
          });
        });
        if (SUMITNOW == 0) {
          return res.status(400).send({ error: `ERROR of total amount = 0` });
        }

        await new Promise((resolve, reject) => {
          db.commit((err) => {
            if (err) {
              db.rollback(() => {
                reject(err);
              });
            } else {
              resolve();
            }
          });
        });

        res.status(200).json({ success: true, message: "Checkout completed" });
      });
    } catch (error) {
      console.error("Error during checkout:", error);

      // Rollback transaction
      usePooledConnectionAsync(async (db) => {
        await new Promise((resolve, reject) => {
          db.rollback((err) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
        });
      });

      return res
        .status(500)
        .json({ success: false, message: "Internal Server Error" });
    }
  }
);

app.post("/farmerorder", async (req, res) => {
  try {
    await usePooledConnectionAsync(async (db) => {
      const { order_id, status } = req.body;
      async function addComment(order_id, comment) {
        const insertCommentQuery =
          "UPDATE order_sumary SET comment = ? WHERE id = ?";
        await new Promise((resolve, reject) => {
          db.query(insertCommentQuery, [comment, order_id], (err, result) => {
            if (err) {
              reject(err);
            } else {
              resolve(result);
            }
          });
        });
      }

      const updateDonedate =
        "UPDATE order_sumary SET date_complete = NOW() WHERE id = ?";
      await new Promise((resolve, reject) => {
        db.query(updateDonedate, [order_id], (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });
      // Validate request body
      if (!order_id || !status) {
        return res
          .status(400)
          .json({ success: false, message: "Incomplete request data" });
      }

      if (status === "complete") {
        // Update comment to null for complete status
        await addComment(order_id, null);
      } else if (status === "reject") {
        const { comment } = req.body;
        if (!comment) {
          return res.status(400).json({
            success: false,
            message: "Comment is required for rejection",
          });
        }
        await addComment(order_id, comment);
      }

      // Update order status in the database
      const updateOrderStatusQuery =
        "UPDATE order_sumary SET status = ? WHERE id = ?";
      await new Promise((resolve, reject) => {
        db.query(updateOrderStatusQuery, [status, order_id], (err, result) => {
          if (err) {
            reject(err);
          } else {
            if (result.affectedRows === 0) {
              return res
                .status(404)
                .json({ success: false, message: "Order not found" });
            }
            resolve(result);
          }
        });
      });

      return res
        .status(200)
        .json({ success: true, message: "Order status updated successfully" });
    });
  } catch (error) {
    console.error("Error updating order status:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
});

app.get("/orderlist", async (req, res) => {
  try {
    await usePooledConnectionAsync(async (db) => {
      const token = req.headers.authorization
        ? req.headers.authorization.split(" ")[1]
        : null;

      const decoded = jwt.verify(token, secretKey);
      const orderQuery =
        "SELECT os.*, os.address, m.firstname, m.lastname, m.phone FROM order_sumary os INNER JOIN members m on m.id = os.member_id WHERE member_id = ?";
      const orders = await new Promise((resolve, reject) => {
        db.query(orderQuery, [decoded.ID], async (err, result) => {
          if (err) {
            reject(err);
          } else {
            for (const order of result) {
              if (!order.transaction_confirm) {
                order.transaction_confirm = null;
              }
              const products = await new Promise((resolve, reject) => {
                const orderItemsQuery =
                  "SELECT oi.product_id, p.product_name, p.product_image, oi.quantity, p.price FROM order_items oi INNER JOIN products p ON oi.product_id = p.product_id WHERE oi.order_id = ?";
                db.query(orderItemsQuery, [order.id], async (err, result) => {
                  if (err) {
                    reject(err);
                  } else {
                    Promise.all(
                      result.map(async (product) => {
                        return await new Promise((resolve, reject) => {
                          const getCommentQuery =
                            "SELECT review_id ,rating, date_comment, comment FROM product_reviews WHERE product_id = ? and order_id = ? and available = 1";
                          db.query(
                            getCommentQuery,
                            [product.product_id, order.id],
                            (err, result) => {
                              if (err) {
                                reject(err);
                              } else {
                                resolve({
                                  product_id: product.product_id,
                                  product_name: product.product_name,
                                  product_image: product.product_image,
                                  quantity: product.quantity,
                                  price: product.price,
                                  comment: result[0] ? result[0] : null,
                                });
                              }
                            }
                          );
                        });
                      })
                    ).then((formattedProducts) => {
                      resolve(formattedProducts);
                    });
                  }
                });
              });
              order.products = products;
              order.date_buys = new Date(order.date_buys).toLocaleString();
              order.date_complete = order.date_complete
                ? new Date(order.date_complete).toLocaleString()
                : null;

              delete order.member_id;
            }
            resolve(result);
          }
        });
      });
      res.status(200).json({ success: true, orders: orders });
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

app.post(
  "/confirmtrancsaction",
  upload.fields([{ name: "image", maxCount: 1 }]),
  async (req, res) => {
    try {
      const productSlipFile = req.files["image"] ? req.files["image"][0] : null;
      const productSlipPath = productSlipFile
        ? `./uploads/${productSlipFile.filename}`
        : null;

      const token = req.headers.authorization
        ? req.headers.authorization.split(" ")[1]
        : null;
      const decoded = jwt.verify(token, secretKey);

      // Check if product slip file exists in the request
      if (!productSlipFile) {
        return res
          .status(400)
          .json({ success: false, message: "Product slip file is required" });
      }

      // Extract order_id from the request
      const { order_id } = req.body;
      const orderQuery =
        "UPDATE order_sumary SET transaction_confirm = ? ,status = ? WHERE id = ? AND member_id = ?";

      const updatedOrders = await usePooledConnectionAsync(async (db) => {
        return await new Promise(async (resolve, reject) => {
          db.query(
            orderQuery,
            [productSlipPath, "pending", order_id, decoded.ID],
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

      // Return success response with the updated orders
      res.status(200).json({
        success: true,
        message: "Order transaction confirmation updated successfully",
        orders: updatedOrders,
      });
    } catch (error) {
      // Handle errors
      console.error("Error updating order transaction confirmation:", error);
      res
        .status(500)
        .json({ success: false, message: "Internal Server Error" });
    }
  }
);

app.get("/imagestore", async (req, res) => {
  const token = req.headers.authorization
    ? req.headers.authorization.split(" ")[1]
    : null;
  if (!token) {
    return res.status(400).json({ error: "Token not provided" });
  }
  try {
    const decoded = jwt.verify(token, secretKey);

    const imageQuery = "SELECT imagepath FROM image WHERE farmer_id = ?";
    const images = await usePooledConnectionAsync(async (db) => {
      return await new Promise(async (resolve, reject) => {
        db.query(imageQuery, [decoded.ID], (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });
    });
    let allimage = {
      images: [],
      videos: [],
    };
    images.forEach((image) => {
      if (image.imagepath.match(/\.(mp4|webm|ogg|ogv|avi|mov|wmv|flv|3gp)$/i)) {
        allimage.videos.push(image.imagepath);
      } else {
        allimage.images.push(image.imagepath);
      }
    });
    res.status(200).json({ ...allimage });
  } catch (error) {
    console.error("Error fetching images:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});
app.post(
  "/imageupload",
  upload.fields([{ name: "image", maxCount: 10 }]),
  async (req, res) => {
    try {
      const token = req.headers.authorization
        ? req.headers.authorization.split(" ")[1]
        : null;
      const decoded = jwt.verify(token, secretKey);
      if (!req.files["image"]) {
        return res
          .status(400)
          .json({ success: false, message: "No images uploaded" });
      }
      const imagePaths = req.files["image"]
        ? req.files["image"].map((file) => `./uploads/${file.filename}`)
        : null;
      await usePooledConnectionAsync(async (db) => {
        imagePaths.map(async (imagePath, index) => {
          async function getNextImageId(index) {
            return await new Promise(async (resolve, reject) => {
              try {
                db.query(
                  "SELECT MAX(id) as maxId FROM image",
                  (err, result) => {
                    if (err) {
                      // return res
                      //   .status(500)
                      //   .json({ success: false, message: JSON.stringify(err) });
                      reject(err);
                    } else {
                      let nextimageId = "IMG000000001";
                      if (result[0].maxId) {
                        const currentId = result[0].maxId;
                        const numericPart =
                          parseInt(currentId.substring(3), 10) + 1 + index;
                        nextimageId =
                          "IMG" + numericPart.toString().padStart(9, "0");
                      }
                      resolve(nextimageId);
                    }
                  }
                );
              } catch (error) {
                // return res
                //   .status(500)
                //   .json({ success: false, message: JSON.stringify(error) });
                reject(error);
              }
            });
          }
          const nextimageId = await getNextImageId(index);
          const insertImageQuery =
            "INSERT INTO image (id, imagepath, farmer_id) VALUES (?,?, ?)";
          return await new Promise(async (resolve, reject) => {
            try {
              db.query(
                insertImageQuery,
                [nextimageId, imagePath, decoded.ID],
                (err, result) => {
                  if (err) {
                    // return res
                    //   .status(500)
                    //   .json({ success: false, message: JSON.stringify(err) });
                    reject(err);
                  } else {
                    resolve(result);
                  }
                }
              );
            } catch (error) {
              // return res
              //   .status(500)
              //   .json({ success: false, message: JSON.stringify(err) });
              reject(error);
            }
          });
        });
      });

      res
        .status(200)
        .json({ success: true, message: "Images uploaded successfully" });
    } catch (error) {
      // Handle errors
      console.error("Error uploading images:", error);
      return res
        .status(500)
        .json({ success: false, message: JSON.stringify(err) });
    }
  }
);

app.get("/farmerorder", async (req, res) => {
  try {
    const token = req.headers.authorization
      ? req.headers.authorization.split(" ")[1]
      : null;
    const decoded = jwt.verify(token, secretKey);
    const orderItemsQuery = `
    SELECT oi.order_id, oi.product_id, oi.quantity, p.price, 
    os.total_amount, os.transaction_confirm, os.date_buys, os.date_complete, os.status, os.tracking_number, os.address, os.shippingcost,
    m.id, m.firstname, m.lastname, m.phone,
    p.product_name, p.product_image
    FROM order_items oi
    INNER JOIN order_sumary os ON oi.order_id = os.id
    INNER JOIN members m ON os.member_id = m.id
    INNER JOIN products p ON oi.product_id = p.product_id
    INNER JOIN farmers f ON p.farmer_id = f.id
    WHERE f.id = ?
    `;
    const orderItemsResult = await usePooledConnectionAsync(async (db) => {
      return await new Promise(async (resolve, reject) => {
        db.query(orderItemsQuery, [decoded.ID], (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });
    });

    const farmerOrdersMap = new Map();
    orderItemsResult.forEach((orderItem) => {
      const order_id = orderItem.order_id;
      if (!farmerOrdersMap.has(order_id)) {
        farmerOrdersMap.set(order_id, {
          order_id: order_id,
          products: [],
          tracking_number: orderItem.tracking_number,
          total_amount: orderItem.total_amount,
          transaction_confirm: orderItem.transaction_confirm,
          customer_info: {
            member_id: orderItem.id,
            firstname: orderItem.firstname,
            lastname: orderItem.lastname,
            phone: orderItem.phone,
            address: orderItem.address,
          },
          date_buys: new Date(orderItem.date_buys).toLocaleString(),
          date_complete: orderItem.date_complete
            ? new Date(orderItem.date_complete).toLocaleString()
            : null,
          status: orderItem.status,
        });
      }
      farmerOrdersMap.get(order_id).products.push({
        product_id: orderItem.product_id,
        product_name: orderItem.product_name,
        product_image: orderItem.product_image,
        quantity: orderItem.quantity,
        price: orderItem.price,
      });
    });

    const farmerOrders = Array.from(farmerOrdersMap.values());
    res.json(farmerOrders);
  } catch (error) {
    console.error("Error fetching farmer orders:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

app.get("/aumpherproduct", checkTambonProvider, async (req, res) => {
  try {
    usePooledConnectionAsync(async (db) => {
      const query = `SELECT count(*) as count, amphure FROM farmers GROUP BY amphure;`;
      db.query(query, async (err, result) => {
        if (err) {
          console.log(err);
          res
            .status(500)
            .send({ exist: false, error: "Internal Server Error" });
        } else {
          let allAmpher = {
            จังหวัดอื่นๆ: 0,
            เมืองนนทบุรี: 0,
            บางบัวทอง: 0,
            บางกรวย: 0,
            บางใหญ่: 0,
            ปากเกร็ด: 0,
            ไทรน้อย: 0,
          };
          let key = Object.keys(allAmpher);
          result.forEach((element) => {
            if (key.includes(element.amphure)) {
              allAmpher[element.amphure] += element.count;
            }
            allAmpher["จังหวัดอื่นๆ"] += element.count;
          });
          res.json(result);
        }
      });
    });
  } catch (error) {
    console.error("Error fetching farmer orders:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

app.post("/confirmorder", async (req, res) => {
  try {
    const { order_id, status, comment, tracking_number } = req.body;
    if (!order_id || !status) {
      return res
        .status(400)
        .json({ success: false, message: "Incomplete request data" });
    }

    if (status !== "complete" && status !== "reject" && status !== "waiting") {
      return res
        .status(400)
        .json({ success: false, message: "Invalid status" });
    }

    const updateOrderStatusQuery = `UPDATE order_sumary SET status = ? ${
      comment ? `,comment = "${comment}"` : ""
    } ${
      status == "complete"
        ? `${`,tracking_number = "${tracking_number}",date_complete = NOW()`}`
        : ""
    } WHERE id = ?`;

    const updatedOrders = await usePooledConnectionAsync(async (db) => {
      return await new Promise(async (resolve, reject) => {
        db.query(updateOrderStatusQuery, [status, order_id], (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });
    });

    res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      orders: updatedOrders,
    });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

app.post("/comment", async (req, res) => {
  const { rating, comment, product_id, order_id } = req.body;
  try {
    const token = req.headers.authorization
      ? req.headers.authorization.split(" ")[1]
      : null;
    const decoded = jwt.verify(token, secretKey);

    // Function to get the next review ID
    async function getNextReviewId() {
      return await usePooledConnectionAsync(async (db) => {
        return new Promise(async (resolve, reject) => {
          db.query(
            "SELECT MAX(review_id) as maxId  FROM product_reviews",
            (err, result) => {
              if (err) {
                reject(err);
              } else {
                let nextRev = "REV0000001";
                if (result[0].maxId) {
                  const currentId = result[0].maxId;
                  const numericPart = parseInt(currentId.substring(3), 10) + 1;
                  nextRev = "REV" + numericPart.toString().padStart(7, "0");
                }
                resolve(nextRev);
              }
            }
          );
        });
      });
    }
    const checkOrderStatusQuery = `
      SELECT os.id AS order_id 
      FROM order_sumary os 
      INNER JOIN order_items oi ON os.id = oi.order_id 
      WHERE os.member_id = ? 
      AND oi.product_id = ? 
      AND os.status = 'complete'
      `;
    const orderResult = await usePooledConnectionAsync(async (db) => {
      return await new Promise(async (resolve, reject) => {
        db.query(
          checkOrderStatusQuery,
          [decoded.ID, product_id],
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

    if (!orderResult || orderResult.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "Member has not purchased this product or order is not complete",
      });
    }

    if (!decoded.ID || !product_id || !rating) {
      return res
        .status(400)
        .json({ success: false, message: "Incomplete comment data" });
    }
    if (rating < 1 || rating > 5) {
      return res
        .status(400)
        .json({ success: false, message: "Rating must be between 1 and 5" });
    }

    await usePooledConnectionAsync(async (db) => {
      const checkOrderQuery = `SELECT os.id AS order_id FROM order_sumary os INNER JOIN order_items oi ON os.id = oi.order_id 
        WHERE os.member_id = ? AND oi.product_id = ?`;
      const [orderResult] = await new Promise(async (resolve, reject) => {
        db.query(checkOrderQuery, [decoded.ID, product_id], (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });

      const checkDuplicateOrderQuery =
        "SELECT * FROM product_reviews WHERE order_id = ? AND product_id = ?";
      const duplicateOrders = await new Promise(async (resolve, reject) => {
        db.query(
          checkDuplicateOrderQuery,
          [order_id, product_id],
          (err, result) => {
            // เพิ่มเงื่อนไขในการตรวจสอบซ้ำด้วย product_id
            if (err) {
              reject(err);
            } else {
              resolve(result);
            }
          }
        );
      });

      if (duplicateOrders.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Order ID already exists in product reviews",
        });
      }

      if (!orderResult || orderResult.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Member has not purchased this product",
        });
      }

      const nextReviewId = await getNextReviewId();

      const insertCommentQuery = `INSERT INTO product_reviews (review_id, member_id, rating, comment, product_id,order_id,date_comment) 
        VALUES (?, ?, ?, ?, ?, ?,NOW())`;

      db.query(
        insertCommentQuery,
        [nextReviewId, decoded.ID, rating, comment, product_id, order_id],
        (err, result) => {
          if (err) {
            console.error("Error adding comment:", err);
          } else {
            return res
              .status(200)
              .json({ success: true, message: "Comment added successfully" });
          }
        }
      );
    });
  } catch (error) {
    console.error("Error adding comment:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
});
app.get("/getcomment/:id", async (req, res) => {
  const id = req.params.id;
  if (!id) {
    return res
      .status(400)
      .json({ success: false, error: "Invalid product ID" });
  }
  await usePooledConnectionAsync(async (db) => {
    db.query(
      `SELECT pr.review_id, pr.member_id, m.username AS member_username, pr.product_id, pr.order_id, pr.rating, pr.comment,
       DATE_FORMAT(pr.date_comment, "%Y-%m-%d %H:%i:%s") AS date_comment
       FROM product_reviews pr LEFT JOIN members m ON pr.member_id = m.id 
      WHERE pr.product_id = ? AND pr.available = 1`,
      [id],
      (err, result) => {
        if (err) {
          console.error(err);
          return res
            .status(500)
            .json({ success: false, error: "Internal Server Error" });
        }
        // ส่งข้อมูลความคิดเห็นกลับไปในรูปแบบ JSON
        res.json({ success: true, reviews: result });
      }
    );
  });
});
app.post("/editcomment/:id", async (req, res) => {
  try {
    await usePooledConnectionAsync(async (db) => {
      const commentId = req.params.id;
      const { rating, comment } = req.body;
      const token = req.headers.authorization
        ? req.headers.authorization.split(" ")[1]
        : null;
      const decoded = jwt.verify(token, secretKey);
      // ตรวจสอบค่า ID ที่รับเข้ามา
      if (!commentId) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid comment ID" });
      }
      // เชื่อมต่อกับฐานข้อมูลเพื่อดึงข้อมูลความคิดเห็น
      const getCommentQuery =
        "SELECT * FROM product_reviews WHERE review_id = ?";
      const [existingComment] = await new Promise((resolve, reject) => {
        db.query(getCommentQuery, [commentId], (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });
      if (decoded.ID != existingComment.member_id) {
        return res
          .status(403)
          .json({ success: false, error: "Unauthorized access" });
      }
      if (rating < 1 || rating > 5) {
        return res
          .status(400)
          .json({ success: false, message: "Rating must be between 1 and 5" });
      }
      if (!existingComment) {
        return res
          .status(404)
          .json({ success: false, error: "Comment not found" });
      }
      const updateCommentQuery =
        "UPDATE product_reviews SET rating = ?, comment = ? WHERE review_id = ?";
      const EDITC = await new Promise((resolve, reject) => {
        db.query(
          updateCommentQuery,
          [rating, comment, commentId],
          (err, result) => {
            if (err) {
              reject(err);
            } else {
              resolve(result);
            }
          }
        );
      });

      res
        .status(200)
        .json({ success: true, message: "Comment updated successfully" });
    });
  } catch (error) {
    console.error("Error editing comment:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

// app.post("/deletecomment/:id", async (req, res) => {
//   const commentId = req.params.id;
//   const token = req.headers.authorization
//     ? req.headers.authorization.split(" ")[1]
//     : null;
//   const decoded = jwt.verify(token, secretKey);

//   // ตรวจสอบค่า ID ที่รับเข้ามา
//   if (!commentId) {
//     return res
//       .status(400)
//       .json({ success: false, error: "Invalid comment ID" });
//   }
//   try {
//     // เชื่อมต่อกับฐานข้อมูลเพื่อดึงข้อมูลความคิดเห็น
//     await usePooledConnectionAsync(async (db) => {
//       const getCommentQuery =
//         "SELECT * FROM product_reviews WHERE review_id = ?";
//       const [existingComment] = await new Promise((resolve, reject) => {
//         db.query(getCommentQuery, [commentId], (err, result) => {
//           if (err) {
//             reject(err);
//           } else {
//             resolve(result);
//           }
//         });
//       });
//       // ตรวจสอบว่าผู้ใช้เป็นเจ้าของความคิดเห็นหรือไม่
//       if (decoded.ID != existingComment.member_id) {
//         return res
//           .status(403)
//           .json({ success: false, error: "Unauthorized access" });
//       }
//       // อัปเดตค่าความคิดเห็น (Soft Delete)
//       const softDeleteCommentQuery =
//         "UPDATE product_reviews SET available = 0 WHERE review_id = ?";
//       await new Promise((resolve, reject) => {
//         db.query(softDeleteCommentQuery, [commentId], (err, result) => {
//           if (err) {
//             reject(err);
//           } else {
//             resolve(result);
//           }
//         });
//       });
//     });
//     res
//       .status(200)
//       .json({ success: true, message: "Comment soft deleted successfully" });
//   } catch (error) {
//     console.error("Error soft deleting comment:", error);
//     res.status(500).json({ success: false, message: "Internal Server Error" });
//   }
// });

// app.get('/excel', async (req, res) => {
//   try {
//     await usePooledConnectionAsync(async db => {
//       const sqlQuery = `
//         SELECT
//           f.id AS farmer_id,
//           f.email,
//           f.username,
//           f.firstname,
//           f.lastname,
//           f.farmerstorename,
//           f.phone,
//           p.product_id,
//           p.product_name,
//           p.stock,
//           p.price
//         FROM
//           farmers f
//         LEFT JOIN
//           products p ON f.id = p.farmer_id
//       `;

//       const data = await new Promise((resolve, reject) => {
//         db.query(sqlQuery, (err, result) => {
//           if (err) {
//             reject(err);
//           } else {
//             resolve(result);
//           }
//         });
//       });
//       console.log(data);
//       const workbook = new excel.Workbook();

//       const farmerWorksheet = workbook.addWorksheet('Farmers');
//       const farmerHeaders = ['ID', 'Email', 'Username', 'Firstname', 'Lastname', 'Farmerstore', 'Phone','TOTAL Product'];
//       farmerWorksheet.addRow(farmerHeaders); // Add header row

//       const farmerProductSheets = {}; // Store farmer product worksheets

//       const addedFarmerIds = {}; // Store added farmer ids
//       const productCounts = {};
//       data.forEach(row => {
//         // Check if farmer ID is already added
//         if (!productCounts[row.farmer_id]) {
//           productCounts[row.farmer_id] = 1;
//         } else {
//           productCounts[row.farmer_id]++;
//         }
//         if (!addedFarmerIds[row.farmer_id]) {
//           const rowData = [row.farmer_id, row.email, row.username, row.firstname, row.lastname, row.farmerstorename,row.phone,productCounts];
//           farmerWorksheet.addRow(rowData); // Add farmer data row
//           addedFarmerIds[row.farmer_id] = true; // Mark farmer ID as added
//         }

//         // Create product sheet for each farmer if not already exists
//         if (!farmerProductSheets[row.farmer_id]) {
//           farmerProductSheets[row.farmer_id] = workbook.addWorksheet(`Products_${row.farmer_id}`);
//           const productHeaders = ['Product ID', 'Product Name', 'Stock', 'Price',];
//           farmerProductSheets[row.farmer_id].addRow(productHeaders); // Add header row
//           farmerProductSheets[row.farmer_id].getCell('E1').value = {
//             text: 'Back to Farmers',
//             hyperlink: `#Farmers!A1`,
//             tooltip: 'Go back to Farmers'
//           };
//         }
//         // Add product data to corresponding farmer's product sheet
//         const productData = [row.product_id, row.product_name, row.stock, row.price];
//         farmerProductSheets[row.farmer_id].addRow(productData); // Add product data row

//         // Add hyperlink in farmer worksheet to link to product sheet
//         farmerWorksheet.getCell(`A${farmerWorksheet.lastRow.number}`).value = {
//           text: row.farmer_id,
//           hyperlink: `#Products_${row.farmer_id}!A1`,
//           tooltip: `Go to Products for ${row.farmer_id}`
//         };
//       });

//       // Send excel file back
//       res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
//       res.setHeader('Content-Disposition', 'attachment; filename="farmers_and_products.xlsx"');
//       await workbook.xlsx.write(res);
//       res.end();
//     });

//   } catch (error) {
//     console.error('Error generating excel:', error);
//     res.status(500).json({ success: false, message: 'Internal Server Error' });
//   }
// });

app.get("/excel", async (req, res) => {
  const farmerStyles = {
    header: {
      font: { bold: true, size: 12, color: { argb: "FFFFFF" } }, // ตัวอักษรหนา ขนาด 12 สีขาว
      alignment: { horizontal: "center" },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: "2E74B5" } }, // สีเขียว
    },
    downloadRow: {
      font: { bold: true, size: 10, color: { argb: "000000" } }, // ตัวอักษรหนา ขนาด 10 สีดำ
      alignment: { horizontal: "right" },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFD966" } }, // สีเหลือง
    },
    totalRow: {
      font: { bold: true, size: 10, color: { argb: "000000" } }, // ตัวอักษรหนา ขนาด 10 สีดำ
      alignment: { horizontal: "right" },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: "CCFFCC" } }, // สีเขียวอ่อน
    },
    middleRow: {
      font: { bold: true, size: 11, color: { argb: "0000FF" } }, // ตัวอักษรหนา ขนาด 11 สีน้ำเงิน
      alignment: { horizontal: "right" },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFF00" } }, // สีเหลือง
    },
    THEBEST: {
      font: { bold: true, size: 50, color: { argb: "0000FF" } },
      alignment: { horizontal: "center", vertical: "middle" },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: "a4ffa4" } }, // สีเหลือง
    },
  };
  try {
    await usePooledConnectionAsync(async (db) => {
      // Query data of farmers
      const farmerSqlQuery = `
      SELECT 
    f.id AS farmer_id, 
    f.email, 
    f.username, 
    f.firstname, 
    f.lastname, 
    f.farmerstorename, 
    f.phone,
    IFNULL(COUNT(p.product_id), 0) AS product_count
FROM 
    farmers f
LEFT JOIN 
    products p ON f.id = p.farmer_id AND p.available = 1
GROUP BY
    f.id, f.email, f.username, f.firstname, f.lastname, f.farmerstorename, f.phone;

      `;

      const farmersData = await new Promise((resolve, reject) => {
        db.query(farmerSqlQuery, (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });

      const workbook = new excel.Workbook();

      const farmerWorksheet = workbook.addWorksheet("Farmers", {
        properties: { tabColor: { argb: "FF00BFFF" } },
        pageSetup: { paperSize: 9, orientation: "landscape" },
      });
      farmerWorksheet.mergeCells("A1:H1");
      farmerWorksheet.getCell("A1").value = "THE BEST KASET NONT";

      farmerWorksheet.eachRow((row) => {
        row.eachCell((cell) => {
          cell.font = farmerStyles.THEBEST.font;
          cell.alignment = farmerStyles.THEBEST.alignment;
          cell.fill = farmerStyles.THEBEST.fill;
        });
      });
      momentz.locale("th"); // กำหนดภาษาเป็นไทย
      const downloadDate = momentz
        .tz("Asia/Bangkok")
        .format("DD-MM-YYYY HH:mm:ss");
      const totalFarmers = farmersData.length;

      const downloadRow = farmerWorksheet.addRow([
        "ข้อมูลออกณวันที่ :",
        downloadDate,
        "",
        "",
        "",
        "",
        "",
        "",
      ]);
      const totalRow = farmerWorksheet.addRow([
        "จำนวนเกษตรกรทั้งหมด :",
        totalFarmers,
        "",
        "",
        "",
        "",
        "",
        "",
      ]);
      farmerWorksheet.columns.forEach((column) => {
        column.width = 25;
      });
      const farmerHeaders = [
        "รหัสเกษตรกร",
        "อีเมล",
        "ชื่อผู้ใช้เกษตรกร",
        "ชื่อจริง",
        "นามสกุล",
        "ชื่อร้านค้า",
        "หมายเลขโทรศัพท์",
        "สินค้าที่ขายทั้งหมด",
      ];

      const headerRow = farmerWorksheet.addRow(farmerHeaders);
      headerRow.eachCell((cell) => {
        cell.font = farmerStyles.header.font;
        cell.alignment = farmerStyles.header.alignment;
        cell.fill = farmerStyles.header.fill;
      });

      farmerWorksheet.columns.forEach((column) => {
        column.width = 25;
      });

      farmerWorksheet.views = [
        { state: "frozen", xSplit: 0, ySplit: 1, activeCell: "B2" },
      ];

      const farmerProductSheets = {};

      farmersData.forEach((row) => {
        const rowData = [
          row.farmer_id,
          row.email,
          row.username,
          row.firstname,
          row.lastname,
          row.farmerstorename,
          row.phone,
          row.product_count,
        ];
        const farmerRow = farmerWorksheet.addRow(rowData);

        farmerWorksheet.getCell(`A${farmerRow.number}`).value = {
          text: row.farmer_id,
          hyperlink: `#Products_${row.farmer_id}!A1`,
          tooltip: `Go to Products for ${row.farmer_id}`,
        };

        const productSheet = workbook.addWorksheet(
          `Products_${row.farmer_id}`,
          {
            properties: { tabColor: { argb: "FF00FF00" } },
          }
        );
        const productHeaders = [
          "รหัสสินค้า",
          "ชื่อสินค้า",
          "คงเหลือในคลัง",
          "ราคา",
        ];
        const productHead = productSheet.addRow(productHeaders);
        productHead.eachCell((cell) => {
          cell.font = farmerStyles.header.font;
          cell.alignment = farmerStyles.header.alignment;
          cell.fill = farmerStyles.header.fill;
        });

        productSheet.columns.forEach((column) => {
          column.width = 20;
        });
        farmerProductSheets[row.farmer_id] = productSheet;
      });

      for (const farmerId in farmerProductSheets) {
        const productSheet = farmerProductSheets[farmerId];
        const productsSqlQuery = `
          SELECT 
            product_id, 
            product_name, 
            stock, 
            price
          FROM 
            products
          WHERE 
            farmer_id = ?
        `;
        const productsData = await new Promise((resolve, reject) => {
          db.query(productsSqlQuery, [farmerId], (err, result) => {
            if (err) {
              reject(err);
            } else {
              resolve(result);
            }
          });
        });

        productsData.forEach((product) => {
          const productData = [
            product.product_id,
            product.product_name,
            product.stock,
            product.price,
          ];
          const productRow = productSheet.addRow(productData);

          // แต่งสไตล์ของแถวข้อมูลในตาราง Product
          productRow.eachCell((cell) => {
            cell.font = farmerStyles.middleRow.font;
            cell.alignment = farmerStyles.middleRow.alignment;
            cell.fill = farmerStyles.middleRow.fill;
          });
        });

        // เพิ่มลิงก์ที่ชี้กลับไปยังหน้ารายการเกษตรกร
        productSheet.getCell(`E${productSheet.lastRow.number}`).value = {
          text: "กลับไปหน้าหลัก",
          hyperlink: "#Farmers!A1",
          tooltip: "Go back to Farmers",
          font: { color: { argb: "0000FF" }, underline: true },
          alignment: { vertical: "middle", horizontal: "center" },
          border: {
            top: { style: "thin", color: { argb: "000000" } },
            left: { style: "thin", color: { argb: "000000" } },
            bottom: { style: "thin", color: { argb: "000000" } },
            right: { style: "thin", color: { argb: "000000" } },
          },
          fill: {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFF00" }, // สีเหลือง
          },
          onClick: () => {
            window.location.href = "#Farmers!A1";
          }, // กระทำเมื่อคลิกที่ปุ่ม
        };
      }

      downloadRow.eachCell((cell) => {
        cell.font = farmerStyles.downloadRow.font;
        cell.alignment = farmerStyles.downloadRow.alignment;
        cell.fill = farmerStyles.downloadRow.fill;
      });
      totalRow.eachCell((cell) => {
        cell.font = farmerStyles.totalRow.font;
        cell.alignment = farmerStyles.totalRow.alignment;
        cell.fill = farmerStyles.totalRow.fill;
      });

      const currentDate = moment().format("YYYY-MM-DD_HH-mm-ss");
      const filename = `farmers_and_products_${currentDate}.xlsx`;

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );
      await workbook.xlsx.write(res);
      res.end();
    });
  } catch (error) {
    console.error("Error generating excel:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

app.post("/changepassword", async (req, res) => {
  const { oldpassword, newpassword, usernameBody, roleBody } = req.body;
  const token = req.headers.authorization
    ? req.headers.authorization.split(" ")[1]
    : null;
  if (oldpassword === "" || newpassword === "") {
    return res
      .status(400)
      .json({ success: false, message: "Password cannot be empty" });
  }
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
    if (
      roleDecoded !== "admins" &&
      !(roleDecoded === "tambons" && roleBody === "farmers")
      // roleDecoded !== "admins" &&
      // !(roleDecoded === "tambons" && roleBody !== "farmers")
    ) {
      if (
        !(await checkMatchPssword(roleDecoded, usernameDecoded, oldpassword))
      ) {
        return res
          .status(400)
          .json({ success: false, message: "Password not match" });
      }
    }

    const newHashedPassword = await bcrypt.hash(newpassword, 10);
    console.log(newHashedPassword);
    await usePooledConnectionAsync(async (db) => {
      return await new Promise((resolve, reject) => {
        if (roleDecoded === "tambons" && roleBody === "farmers") {
          roleDecoded = "farmers";
          usernameDecoded = usernameBody;
        }
        db.query(
          `UPDATE ${
            roleDecoded !== "admins" ? roleDecoded : roleBody
          } SET password = "${newHashedPassword}" WHERE username = "${
            roleDecoded !== "admins" ? usernameDecoded : usernameBody
          }"`,

          (err, result) => {
            console.log(err);
            console.log(result);
            if (err) {
              reject(err);
            } else {
              resolve(result);
            }
          }
        );
        console.log(
          `UPDATE ${
            roleDecoded !== "admins" ? roleDecoded : roleBody
          } SET password = "${newHashedPassword}" WHERE username = "${
            roleDecoded !== "admins" ? usernameDecoded : usernameBody
          }"`
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

app.post("/certificate", checkAdmin, async (req, res) => {
  try {
    return await usePooledConnectionAsync(async (db) => {
      let { name } = req.body;
      //check if name exist
      const checkNameQuery =
        "SELECT standard_name FROM standard_products WHERE standard_name = ? and available = 1";
      const [existingName] = await new Promise((resolve, reject) => {
        db.query(checkNameQuery, [name], (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });
      if (existingName) {
        return res.status(400).json({
          success: false,
          message: "มาตรฐานสินค้าที่เพิ่มเข้ามามีอยู่ในระบบอยู่แล้ว",
        });
      }

      id = await new Promise(async (resolve, reject) => {
        db.query(
          "SELECT MAX(standard_id) as maxId FROM standard_products",
          (err, result) => {
            if (err) {
              reject(err);
            } else {
              let nextId = "ST000";
              if (result[0].maxId) {
                const currentId = result[0].maxId;
                const numericPart = parseInt(currentId.substring(2), 10) + 1;

                nextId = "ST" + numericPart.toString().padStart(3, "0");
              }
              resolve(nextId);
            }
          }
        );
      });
      let query = `INSERT INTO standard_products (standard_id, standard_name) VALUES ("${id}", "${name}")`;

      db.query(query, (err, result) => {
        if (err) {
          console.error("Error adding certificate:", err);
          return res
            .status(500)
            .json({ success: false, message: JSON.stringify(err) });
        } else {
          return res.status(200).json({
            success: true,
            message: "Certificate added successfully",
            id,
          });
        }
      });
    });
  } catch (error) {
    console.error("Error adding certificate:", error);
    return res
      .status(500)
      .json({ success: false, message: JSON.stringify(error) });
  }
});

app.put("/certificate", checkAdmin, async (req, res) => {
  try {
    return await usePooledConnectionAsync(async (db) => {
      let { id, name } = req.body;
      //check if name exist
      const checkNameQuery =
        "SELECT standard_name, standard_id FROM standard_products WHERE standard_name = ? and available = 1";
      const result = await new Promise((resolve, reject) => {
        db.query(checkNameQuery, [name], (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });
      let standard_nameResult = result.find(
        (item) => item.standard_name === name
      );
      if (standard_nameResult && standard_nameResult.standard_id !== id) {
        return res.status(400).json({
          success: false,
          message: "มาตรฐานสินค้าที่เพิ่มเข้ามามีอยู่ในระบบอยู่แล้ว",
        });
      }

      let query = `UPDATE standard_products SET standard_name = "${name}" WHERE standard_id = "${id}"`;
      db.query(query, (err, result) => {
        if (err) {
          console.error("Error adding certificate:", err);
          return res
            .status(500)
            .json({ success: false, message: "Internal Server Error" });
        } else {
          return res.status(200).json({
            success: true,
            message: "Certificate added successfully",
          });
        }
      });
    });
  } catch (error) {
    console.error("Error adding certificate:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
});

app.patch("/certificate", checkAdmin, async (req, res) => {
  try {
    return await usePooledConnectionAsync(async (db) => {
      let { id, status, comment = "" } = req.body;
      //check if name exist
      if (!id || !status) {
        return res.status(400).json({
          success: false,
          message: "Invalid farmer_id or standard_id or status",
        });
      }
      let query = `UPDATE certificate_link_farmer SET status = "${status}", comment = "${comment}" WHERE id = "${id}"`;
      db.query(query, (err, result) => {
        if (err) {
          console.error("Error adding certificate:", err);
          return res
            .status(500)
            .json({ success: false, message: "Internal Server Error" });
        } else {
          return res.status(200).json({
            success: true,
            message: "Certificate added successfully",
          });
        }
      });
    });
  } catch (error) {
    console.error("Error adding certificate:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
});

app.delete("/certificate", checkAdmin, async (req, res) => {
  const { id } = req.body;
  if (!id) {
    return res
      .status(400)
      .json({ success: false, message: "Certificate ID is required" });
  }
  try {
    return await usePooledConnectionAsync(async (db) => {
      const query = `UPDATE standard_products SET available = 0 WHERE standard_id = "${id}"`;
      db.query(query, (err, result) => {
        if (err) {
          console.error("Error deleting certificate:", err);
          return res
            .status(500)
            .json({ success: false, message: "Internal Server Error" });
        } else {
          return res.status(200).json({
            success: true,
            message: "Certificate deleted successfully",
          });
        }
      });
    });
  } catch (error) {
    console.error("Error deleting certificate:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
});

async function insertFollow(memberId, farmerId) {
  const followDate = new Date();
  return await usePooledConnectionAsync(async (db) => {
    return new Promise((resolve, reject) => {
      db.query(
        `INSERT INTO followedbymember (member_id, farmer_id, follow_date) VALUES (?, ?, ?)`,
        [memberId, farmerId, followDate],
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
}

app.post("/followfarmer", async (req, res) => {
  try {
    const { farmer_id } = req.body; // รับค่า farmer_id จาก request body
    const token = req.headers.authorization
      ? req.headers.authorization.split(" ")[1]
      : null;
    const decoded = jwt.verify(token, secretKey);
    if (decoded.role != "members") {
      return res
        .status(401)
        .json({ success: false, message: "You are not allow for do this !!" });
    }
    await insertFollow(decoded.ID, farmer_id);
    await followerMileStone(farmer_id);

    res
      .status(200)
      .send({ followed: true, message: "Successfully followed farmer" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ followed: false, error: "Internal Server Error" });
  }
});

async function unfollowFarmer(memberId, farmerId) {
  return await usePooledConnectionAsync(async (db) => {
    return new Promise((resolve, reject) => {
      db.query(
        `DELETE FROM followedbymember WHERE member_id = ? AND farmer_id = ?`,
        [memberId, farmerId],
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
}

app.delete("/followfarmer", async (req, res) => {
  try {
    const { farmer_id } = req.body;
    const token = req.headers.authorization
      ? req.headers.authorization.split(" ")[1]
      : null;
    const decoded = jwt.verify(token, secretKey);
    if (decoded.role !== "members") {
      return res.status(401).json({
        success: false,
        message: "You are not allowed to perform this action",
      });
    }
    await unfollowFarmer(decoded.ID, farmer_id);

    res
      .status(200)
      .send({ followed: true, message: "Successfully unfollowed farmer" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ followed: false, message: "Internal Server Error" });
  }
});

const followerMileStone = async (farmer_id) => {
  return await usePooledConnectionAsync(async (db) => {
    let allfollowersCount = await new Promise((resolve, reject) => {
      db.query(
        `SELECT COUNT(*) as count FROM followedbymember WHERE farmer_id = ?`,
        [farmer_id],
        (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result[0].count);
          }
        }
      );
    });
    let followerMileStone = [
      2, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000,
      100000, 200000, 500000, 1000000,
    ];
    let followerMileStoneCount = followerMileStone.filter(
      (milestone) => milestone == allfollowersCount
    );
    let followerMileStoneCountLength = followerMileStoneCount.length;

    if (followerMileStoneCountLength > 0) {
      db.query(
        `SELECT farmerstorename FROM farmers WHERE id = ?`,
        [farmer_id],
        (err, result) => {
          if (err) {
            console.log(err);
            return;
          }
          let farmerstorename = result[0].farmerstorename;
          let message = `ยินดีด้วย! ร้านค้าของคุณ ${farmerstorename} ได้มีผู้ติดตามถึง ${followerMileStoneCount[0]} คนแล้ว!`;
          // เคยได้ notification มาแล้วหรือยัง

          db.query(
            `SELECT * FROM notification WHERE recipient_id = ? AND message = ?`,
            [farmer_id, message],
            (err, result) => {
              if (err) {
                console.log(err);
                return;
              }
              if (result.length > 0) {
                return;
              }
              createNotification(
                null,
                farmer_id,
                message,
                "/myproducts",
                "ยินดีด้วย!"
              );
            }
          );
        }
      );
    }

    return;
  });
};

app.get("/followfarmer", async (req, res) => {
  try {
    const token = req.headers.authorization
      ? req.headers.authorization.split(" ")[1]
      : null;
    const decoded = jwt.verify(token, secretKey);

    if (decoded.role !== "members") {
      return res.status(401).json({
        success: false,
        message: "You are not allowed to perform this action",
      });
    }

    const results = await usePooledConnectionAsync(async (db) => {
      return new Promise((resolve, reject) => {
        db.query(
          `SELECT f.id, f.farmerstorename
          FROM farmers f
          INNER JOIN followedbymember fbm ON f.id = fbm.farmer_id
          WHERE fbm.member_id = ?`,
          [decoded.ID],
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

    res.status(200).json({ followed: true, data: results });
  } catch (error) {
    console.error(error);
    res.status(500).json({ followed: false, message: "Internal Server Error" });
  }
});

app.get("/allsum", async (req, res) => {
  try {
    const token = req.headers.authorization
      ? req.headers.authorization.split(" ")[1]
      : null;
    const decoded = jwt.verify(token, secretKey);

    if (decoded.role !== "farmers") {
      return res.status(401).json({
        success: false,
        message: "You are not allowed to perform this action",
      });
    }

    const results = await usePooledConnectionAsync(async (db) => {
      return new Promise((resolve, reject) => {
        db.query(
          `SELECT oi.product_id, oi.quantity as total_quantity, SUM( oi.price) AS total_price,p.product_name, c.category_name
          FROM order_sumary os
          JOIN order_items oi ON os.id = oi.order_id
          JOIN products p ON oi.product_id = p.product_id
          JOIN farmers f ON p.farmer_id = f.id
          JOIN categories c ON c.category_id = p.category_id
          WHERE os.status = 'complete' AND f.id = ?
          GROUP BY oi.product_id order by total_quantity desc;`,
          [decoded.ID],
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

    // นำผลลัพธ์ที่ได้มาประมวลผล
    // const processedResults = {};
    // results.forEach((row) => {
    //   const { product_id, total_quantity, total_price } = row;
    //   if (!processedResults[product_id]) {
    //     processedResults[product_id] = { total_quantity: 0, total_price: 0 };
    //   }
    //   processedResults[product_id].total_quantity = total_quantity;
    //   processedResults[product_id].total_price += parseFloat(total_price); // หรือ Number(total_price)
    // });

    res.status(200).json({ success: true, data: results });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

app.get("/getordersale/:peroid", checkFarmer, async (req, res) => {
  let { peroid } = req.params;
  if (!peroid || (peroid !== "date" && peroid !== "month")) {
    return res.status(400).json({ success: false, message: "Invalid peroid" });
  }
  await usePooledConnectionAsync(async (db) => {
    try {
      let token = req.headers.authorization
        ? req.headers.authorization.split(" ")[1]
        : null;
      let decoded = jwt.verify(token, secretKey);
      let { ID } = decoded;
      db.query(
        `SELECT count(*) as order_sale, ${
          peroid == "date"
            ? "date(os.date_buys)"
            : "CONCAT(MONTH(os.date_buys),'/', YEAR(os.date_buys))"
        } as date 
        , c.category_name, c.bgcolor
        FROM order_sumary os LEFT JOIN order_items oi on oi.order_id = os.id LEFT JOIN products p on p.product_id = oi.product_id LEFT JOIN categories c on c.category_id = p.category_id where p.farmer_id = ? and os.status = "complete" group by ${peroid}(os.date_buys), c.category_name order by os.date_buys desc limit 30;`,
        [ID],
        (err, result) => {
          if (err) {
            console.error(err);
            return res
              .status(500)
              .json({ success: false, error: "Internal Server Error" });
          }
          if (peroid === "month") {
            let j = 0;
            let months = Array.from({ length: 12 }, (_, i) => {
              var today = new Date();
              var monthago = new Date(
                new Date().setDate(today.getDate() - i * 30)
              ).toLocaleDateString();
              monthago = monthago.split("/")[0] + "/" + monthago.split("/")[2];
              let categories = [];
              for (k = j; k < result.length; k++) {
                if (result[j].date == monthago) {
                  categories.push({
                    category_name: result[k].category_name,
                    order_sale: result[k].order_sale,
                    bgcolor: result[k].bgcolor,
                  });
                } else {
                  j = k;
                  break;
                }
              }
              return {
                date: monthago,
                categories: categories,
                order_sale: categories
                  .map((category) => category.order_sale)
                  .reduce((a, b) => a + b, 0),
              };
            });
            let todaysale = months[0].order_sale;
            return res.json({
              success: true,
              orders: months.reverse(),
              today: todaysale,
            });
          }
          let j = 0;
          let days30 = Array.from({ length: 30 }, (_, i) => {
            var today = new Date();
            var dayago = new Date(
              new Date().setDate(today.getDate() - i)
            ).toLocaleDateString();
            // let dayago = moment()
            //   .subtract(i, "days")
            //   .toDate()
            //   .toLocaleDateString();

            let categories = [];
            for (k = j; k < result.length; k++) {
              if (new Date(result[k].date).toLocaleDateString() == dayago) {
                categories.push({
                  category_name: result[k].category_name,
                  order_sale: result[k].order_sale,
                  bgcolor: result[k].bgcolor,
                });
              } else {
                j = k;
                break;
              }
            }

            return {
              date: dayago,
              categories: categories,
              order_sale: categories
                .map((category) => category.order_sale)
                .reduce((a, b) => a + b, 0),
            };
          });
          let todaysale = days30[0].order_sale;
          return res.json({
            success: true,
            orders: days30.reverse(),
            today: todaysale,
          });
        }
      );
    } catch (error) {
      console.error("Error getting orders:", error);
      return res
        .status(500)
        .json({ success: false, message: "Internal Server Error" });
    }
  });
});

app.get("/farmerregister", checkTambonProvider, async (req, res) => {
  await usePooledConnectionAsync(async (db) => {
    try {
      const token = req.headers.authorization
        ? req.headers.authorization.split(" ")[1]
        : null;
      const decoded = jwt.verify(token, secretKey);
      const { role } = decoded;
      db.query(
        `SELECT COUNT(*) AS register_count, DATE(createAt) AS createAt 
        FROM farmers 
        WHERE available = 1 ${
          role === "tambons" ? `AND amphure = "${decoded.amphure}"` : ""
        }
        GROUP BY DATE(createAt) 
        ORDER BY DATE(createAt) DESC 
        LIMIT 30;`,
        (err, result) => {
          if (err) {
            console.error(err);
            return res
              .status(500)
              .json({ success: false, error: "Internal Server Error" });
          }
          let j = 0;
          let days30 = Array.from({ length: 30 }, (_, i) => {
            let dayago = moment()
              .subtract(i, "days")
              .toDate()
              .toLocaleDateString();
            if (
              result[j] &&
              new Date(result[j].createAt).toLocaleDateString() === dayago
            ) {
              j++;
              return {
                createAt: dayago,
                register_count: result[j - 1].register_count,
              };
            }
            return {
              createAt: dayago,
              register_count: 0,
            };
          });

          res.json({ success: true, farmers: days30.reverse() });
        }
      );
    } catch (error) {
      console.error("Error getting farmers:", error);
      return res
        .status(500)
        .json({ success: false, message: "Internal Server Error" });
    }
  });
});

app.get("/allfollowers", checkFarmer, async (req, res) => {
  await usePooledConnectionAsync(async (db) => {
    try {
      const token = req.headers.authorization
        ? req.headers.authorization.split(" ")[1]
        : null;
      const decoded = jwt.verify(token, secretKey);
      const { ID } = decoded;
      let result = await new Promise((resolve, reject) => {
        db.query(
          `SELECT COUNT(*) as follow_count, DATE_FORMAT(follow_date, "%Y-%m-%d") as createAt FROM followedbymember WHERE farmer_id = ? GROUP BY DATE_FORMAT(follow_date, "%Y-%m-%d") ORDER BY follow_date DESC LIMIT 30`,
          [ID],
          (err, result) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(result);
          }
        );
      });
      let j = 0;
      let days30 = Array.from({ length: 30 }, (_, i) => {
        let dayago = moment().subtract(i, "days").toDate().toLocaleDateString();

        if (
          result[j] &&
          new Date(result[j].createAt).toLocaleDateString() === dayago
        ) {
          j++;
          return {
            createAt: dayago,
            follow_count: result[j - 1].follow_count,
          };
        }
        return {
          createAt: dayago,
          follow_count: 0,
        };
      });
      let allfollowers = await new Promise((resolve, reject) => {
        db.query(
          `SELECT COUNT(*) as follow_count FROM followedbymember WHERE farmer_id = ?`,
          [ID],
          (err, result) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(result[0].follow_count);
          }
        );
      });
      return res.json({
        success: true,
        followers: days30.reverse(),
        allfollowers: allfollowers,
      });
    } catch (error) {
      console.error("Error getting followers:", error);
      return res
        .status(500)
        .json({ success: false, message: "Internal Server Error" });
    }
  });
});

app.get("/allcategories", checkTambonProvider, async (req, res) => {
  await usePooledConnectionAsync(async (db) => {
    try {
      const token = req.headers.authorization
        ? req.headers.authorization.split(" ")[1]
        : null;
      const decoded = jwt.verify(token, secretKey);
      const { role } = decoded;
      db.query(
        `SELECT c.category_name as label, COUNT(*) as data, c.bgcolor 
        FROM products p 
        LEFT JOIN categories c ON p.category_id = c.category_id
        LEFT JOIN farmers f ON p.farmer_id = f.id
        WHERE p.available = 1 ${
          role === "tambons" ? `AND f.amphure = "${decoded.amphure}"` : ""
        }
        GROUP BY c.category_name, c.bgcolor;`,
        (err, result) => {
          if (err) {
            console.error(err);
            return res
              .status(500)
              .json({ success: false, error: "Internal Server Error" });
          }
          // add percentage to each category
          let total = result.reduce((acc, curr) => acc + curr.data, 0);
          result = result.map((category) => {
            return {
              ...category,
              label:
                category.label +
                " " +
                ((category.data / total) * 100).toFixed(2) +
                "%",
            };
          });
          return res.json({ success: true, categories: result });
        }
      );
    } catch (error) {
      console.error("Error getting categories:", error);
      return res
        .status(500)
        .json({ success: false, message: "Internal Server Error" });
    }
  });
});

async function getNextResId() {
  return await usePooledConnectionAsync(async (db) => {
    return await new Promise((resolve, reject) => {
      db.query(
        "SELECT MAX(id) as maxId FROM reserve_products",
        (err, result) => {
          if (err) {
            reject(err);
          } else {
            let nextId = "RES000001";
            if (result[0].maxId) {
              const currentId = result[0].maxId;

              const numericPart = parseInt(currentId.substring(3), 10) + 1;

              nextId = "RES" + numericPart.toString().padStart(6, "0");
            }
            resolve(nextId);
          }
        }
      );
    });
  });
}

async function checkReservationToday(product_id) {
  return await usePooledConnectionAsync(async (db) => {
    return new Promise((resolve, reject) => {
      db.query(
        `SELECT COUNT(*) AS count
      FROM reserve_products
      WHERE DATE(reserve_date) = CURDATE()
      AND product_id = ?`,
        [product_id],
        (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result[0].count > 0);
          }
        }
      );
    });
  });
}
async function checkReservestatus(product_id) {
  return await usePooledConnectionAsync(async (db) => {
    return new Promise(async (resolve, reject) => {
      let selectedStatus = await new Promise((resolve, reject) => {
        db.query(
          `SELECT selectedStatus
          FROM products
          WHERE product_id = ? and available = 1 and selectedType = 'จองสินค้าผ่านเว็บไซต์'`,
          [product_id],
          (err, result) => {
            if (err) {
              reject(err);
            } else {
              resolve(result[0].selectedStatus);
            }
          }
        );
      });

      if (selectedStatus === "เปิดรับจองตลอด") {
        resolve("เปิดรับจอง");
      } else if (selectedStatus === "ปิดรับจอง") {
        resolve("ปิดรับจอง");
      }

      db.query(
        `SELECT COUNT(*) AS count
        FROM products
        WHERE product_id = ? AND selectedType = 'จองสินค้าผ่านเว็บไซต์' AND NOW() BETWEEN date_reserve_start AND date_reserve_end`,
        [product_id],
        (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result[0].count > 0 ? "เปิดรับจอง" : "ปิดรับจอง");
          }
        }
      );
    });
  });
}

async function checkPendingStatus(product_id, member_id) {
  try {
    const result = await usePooledConnectionAsync(async (db) => {
      return new Promise((resolve, reject) => {
        db.query(
          `SELECT COUNT(*) AS count
          FROM reserve_products
          WHERE product_id = ? AND member_id = ? AND status = 'pending'`,
          [product_id, member_id],
          (err, result) => {
            if (err) {
              reject(err);
            } else {
              resolve(result[0].count > 0);
            }
          }
        );
      });
    });
    return result;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

app.get("/memberreserve", async (req, res) => {
  try {
    const token = req.headers.authorization
      ? req.headers.authorization.split(" ")[1]
      : null;
    const decoded = jwt.verify(token, secretKey);

    const results = await usePooledConnectionAsync(async (db) => {
      return new Promise((resolve, reject) => {
        db.query(
          `SELECT 
          rp.id, 
          rp.product_id, 
          rp.status, 
          rp.quantity, 
          rp.dates, 
          rp.dates_complete, 
          rp.contact,
          p.product_name,
          p.unit,
          f.id AS farmer_id, 
          f.farmerstorename, 
          f.phone
      FROM 
          reserve_products rp
      INNER JOIN 
          products p ON rp.product_id = p.product_id
      INNER JOIN 
          farmers f ON p.farmer_id = f.id
      WHERE 
          rp.member_id = ?`,
          [decoded.ID],
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

    const formattedResults = results.map((result) => ({
      id: result.id,
      status: result.status,
      reserve_products: {
        product_id: result.product_id,
        product_name: result.product_name,
        unit: result.unit,
        quantity: result.quantity,
      },
      farmer_info: {
        farmer_id: result.farmer_id,
        farmerstorename: result.farmerstorename,
        phone: result.phone,
      },
      dates: result.dates,
      dates_complete: result.dates_complete,
    }));

    res.status(200).json({
      success: true,
      message: "Reservation data retrieved successfully",
      data: formattedResults,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

app.get("/reserve", checkFarmer, async (req, res) => {
  try {
    const token = req.headers.authorization
      ? req.headers.authorization.split(" ")[1]
      : null;
    const decoded = jwt.verify(token, secretKey);

    const results = await usePooledConnectionAsync(async (db) => {
      return new Promise((resolve, reject) => {
        db.query(
          `SELECT 
          rp.id, 
          rp.product_id, 
          rp.status, 
          rp.quantity, 
          rp.dates, 
          rp.dates_complete, 
          rp.contact,
          p.product_name,
          p.unit,
          m.id AS member_id, 
          m.firstname, 
          m.lastname, 
          m.phone
      FROM 
          reserve_products rp
      INNER JOIN 
          members m ON rp.member_id = m.id
      INNER JOIN 
          products p ON rp.product_id = p.product_id
      WHERE 
          p.farmer_id = ?`,
          [decoded.ID],
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

    const formattedResults = results.map((result) => ({
      id: result.id,
      status: result.status,
      reserve_products: {
        product_id: result.product_id,
        product_name: result.product_name,
        unit: result.unit,
        quantity: result.quantity,
      },
      customer_info: {
        member_id: result.member_id,
        firstname: result.firstname,
        lastname: result.lastname,
        phone: result.phone,
        line: result.contact,
      },
      dates: result.dates,
      dates_complete: result.dates_complete,
    }));

    res.status(200).json({
      success: true,
      message: "Reservation data retrieved successfully",
      data: formattedResults,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

app.post("/reserve", checkActivated, async (req, res) => {
  try {
    const { product_id, lineid, quantity } = req.body;
    const token = req.headers.authorization
      ? req.headers.authorization.split(" ")[1]
      : null;
    const decoded = jwt.verify(token, secretKey);
    const nextId = await getNextResId();
    const isProductReservable = await checkReservestatus(product_id);
    const pendingplswait = await checkPendingStatus(product_id, decoded.ID);
    if (isProductReservable === "ปิดรับจอง") {
      return res.status(400).json({
        success: false,
        message: "สินค้านี้ปิดรับจองแล้ว ขออภัยในความไม่สะดวก",
      });
    }
    if (pendingplswait) {
      return res.status(400).json({
        success: false,
        message:
          "ไม่สามารถจองสินค้าซ้ำได้ กรุณารอการอนุมัติการจองของสินค้าเดิมก่อน",
      });
    }

    usePooledConnectionAsync(async (db) => {
      db.query(
        `INSERT INTO reserve_products (id, member_id, status, product_id, contact,quantity, dates)
        VALUES (?, ?, ?, ?, ?, ?, Now())`,
        [nextId, decoded.ID, "pending", product_id, lineid, quantity],
        (err, result) => {
          if (err) {
            console.error(err);
            return res.status(500).json({
              success: false,
              message: "Internal Server Error",
            });
          }
          res.status(200).json({
            success: true,
            message: "Reservation successful",
          });
        }
      );
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

async function CheckFarmerwithproduct(reserve_id) {
  return await usePooledConnectionAsync(async (db) => {
    return new Promise((resolve, reject) => {
      db.query(
        `SELECT rp.product_id, p.farmer_id
        FROM reserve_products rp
        JOIN products p ON rp.product_id = p.product_id
        WHERE rp.id = ?`,
        [reserve_id],
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
}

app.patch("/reserve", async (req, res) => {
  try {
    const { reserve_id, status } = req.body;
    const token = req.headers.authorization
      ? req.headers.authorization.split(" ")[1]
      : null;
    const decoded = jwt.verify(token, secretKey);

    const farmerByProId = await CheckFarmerwithproduct(reserve_id); // ใช้ reserve_id แทน product_id
    // ตรวจสอบว่า farmer ของ product ตรงกับ farmer ที่ลงทะเบียน
    if (
      farmerByProId.length === 0 ||
      farmerByProId[0].farmer_id !== decoded.ID
    ) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to update this reservation",
      });
    }

    await usePooledConnectionAsync(async (db) => {
      return new Promise((resolve, reject) => {
        db.query(
          `UPDATE reserve_products
          SET status = ?, dates_complete = NOW()
          WHERE id = ?`,
          [status, reserve_id],
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

    res.status(200).json({
      success: true,
      message: "Reservation status updated successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

app.get("/farmerinfo", checkTambonProvider, async (req, res) => {
  await usePooledConnectionAsync(async (db) => {
    try {
      db.query(
        `SELECT  f.firstname, f.lastname, f.farmerstorename, f.phone, f.email, f.createAt, COUNT(p.product_id) as product_count from farmers f LEFT JOIN products p on f.id = p.farmer_id and p.available = 1 and f.available = 1 GROUP BY f.id;`,
        (err, result) => {
          if (err) {
            console.error(err);
            return res
              .status(500)
              .json({ success: false, error: "Internal Server Error" });
          }
          res.json({ success: true, farmers: result });
        }
      );
    } catch (error) {
      console.error("Error getting farmer info:", error);
      return res
        .status(500)
        .json({ success: false, message: "Internal Server Error" });
    }
  });
});
app.get("/certifarmer/:username", async (req, res) => {
  try {
    const { username } = req.params;
    if (!username) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid username" });
    }
    const results = await usePooledConnectionAsync(async (db) => {
      let farmer_id = await new Promise((resolve, reject) => {
        db.query(
          `SELECT id FROM farmers WHERE username = ? and available = 1`,
          [username],
          (err, result) => {
            if (err) {
              reject(err);
            } else {
              resolve(result[0].id);
            }
          }
        );
      });
      return new Promise((resolve, reject) => {
        db.query(
          `SELECT * FROM certificate_link_farmer WHERE farmer_id = ? and status not like "reject"`,
          [farmer_id],
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

    res.status(200).json({ success: true, data: results });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});
app.post(
  "/certifarmer",
  upload.fields([{ name: "image", maxCount: 1 }]),
  async (req, res) => {
    try {
      const { standard_id, name, certificate_number, username } = req.body;
      console.log(req.body);
      if (!standard_id) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid standard_id or name" });
      }
      const token = req.headers.authorization
        ? req.headers.authorization.split(" ")[1]
        : null;
      const decoded = jwt.verify(token, secretKey);
      let pathName = null;
      if (req.files && req.files.image) {
        let image = req.files.image[0].filename;
        pathName = "/uploads/" + image;
      }
      const results = await usePooledConnectionAsync(async (db) => {
        let farmer_id = await new Promise((resolve, reject) => {
          db.query(
            `SELECT id FROM farmers WHERE username = ?`,
            [username],
            (err, result) => {
              if (err) {
                reject(err);
              } else {
                resolve(result[0].id);
              }
            }
          );
        });
        let nextId = await getNextCertId();
        return new Promise((resolve, reject) => {
          db.query(
            `INSERT INTO certificate_link_farmer (id, farmer_id, standard_id, name, certificate_number, image_path, status) VALUES (?, ?, ?, ?, ?, ?, "pending")`,
            [
              nextId,
              farmer_id,
              standard_id,
              name,
              certificate_number,
              pathName,
            ],
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
      res.status(200).json({ success: true, data: results });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ success: false, message: "Internal Server Error" });
    }
  }
);
app.get("/certiconver/:product_id", async (req, res) => {
  const { product_id } = req.params;

  try {
    await usePooledConnectionAsync(async (db) => {
      // 1. Retrieve certificates from the products table using product_id
      let query = `SELECT sp.standard_name from certificate_link_farmer clf inner join standard_products sp on clf.standard_id = sp.standard_id WHERE clf.product_id = ? and clf.status = 'complete'`;
      db.query(query, [product_id], (err, result) => {
        if (err) {
          console.error(err);
          return res
            .status(500)
            .json({ success: false, message: "Internal Server Error" });
        }
        res.status(200).json({ success: true, standardNames: result });
      });
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

app.get("/farmerselfinfo", checkFarmer, async (req, res) => {
  await usePooledConnectionAsync(async (db) => {
    try {
      const token = req.headers.authorization
        ? req.headers.authorization.split(" ")[1]
        : null;
      const decoded = jwt.verify(token, secretKey);
      db.query(
        `SELECT 
        f.firstname, 
        f.lastname, 
        f.farmerstorename, 
        f.phone, 
        f.email, 
        f.createAt, 
        COUNT(CASE WHEN p.available = 1 THEN p.product_id ELSE NULL END) AS product_count 
    FROM 
        farmers f 
    LEFT JOIN 
        products p 
    ON 
        f.id = p.farmer_id 
    WHERE 
        f.id = ?
    GROUP BY 
        f.id;`,
        [decoded.ID],
        (err, result) => {
          if (err) {
            console.error(err);
            return res
              .status(500)
              .json({ success: false, error: "Internal Server Error" });
          }

          res.json({ success: true, farmers: result });
        }
      );
    } catch (error) {
      console.error("Error getting farmer info:", error);
      return res
        .status(500)
        .json({ success: false, message: "Internal Server Error" });
    }
  });
});

app.get("/getadmincertificate", checkAdminTambon, async (req, res) => {
  await usePooledConnectionAsync(async (db) => {
    try {
      let token = req.headers.authorization
        ? req.headers.authorization.split(" ")[1]
        : null;
      let decoded = jwt.verify(token, secretKey);
      let tambonamphure =
        decoded.role === "tambons"
          ? `and f.amphure = "${decoded.amphure}"`
          : "";

      db.query(
        `SELECT cf.*, f.firstname, f.lastname, s.standard_name FROM certificate_link_farmer cf join farmers f on f.id = cf.farmer_id join standard_products s on s.standard_id = cf.standard_id where cf.status = "pending" ${tambonamphure}`,
        (err, result) => {
          if (err) {
            console.error(err);
            return res
              .status(500)
              .json({ success: false, error: JSON.stringify(err) });
          }
          res.json({ success: true, certificate: result });
        }
      );
    } catch (error) {
      console.error("Error getting farmer info:", error);
      return res
        .status(500)
        .json({ success: false, message: JSON.stringify(error) });
    }
  });
});

app.get("/repeatactivate", async (req, res) => {
  try {
    const token = req.headers.authorization
      ? req.headers.authorization.split(" ")[1]
      : null;

    const decoded = jwt.verify(token, secretKey);

    const results = await usePooledConnectionAsync(async (db) => {
      return new Promise((resolve, reject) => {
        db.query(
          `SELECT email, firstname, lastname
          FROM members
          WHERE id = ?`,
          [decoded.ID],
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

    if (results.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const { email, firstname, lastname } = results[0];

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "thebestkasetnont@gmail.com",
        pass: "ggtf brgm brip mqvq",
      },
    });

    let url =
      process.env.production == "true"
        ? process.env.url
        : "http://localhost:3000";

    const mailOptions = {
      from: "thebestkasetnont@gmail.com",
      to: email,
      subject: "ยืนยันตัวตน",
      text: `สวัสดีคุณ ${firstname} ${lastname} คุณได้สมัครสมาชิกกับเว็บไซต์ ${url} 
      กรุณายืนยันตัวตนโดยคลิกที่ลิงค์นี้: ${url}/#/confirm/${email}/${encodeURIComponent(
        (await bcrypt.hash(email + secretKey, 10)).replace(/\//g, "slash")
      )}`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Error sending email:", error);
        return res.status(500).json({ error: "Error sending email" });
      } else {
        console.log("Email sent:", info.response);
        return res.status(200).json({ message: "Email sent successfully" });
      }
    });
  } catch (error) {
    console.error("Error verifying email:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// app.post("/festival", checkAdmin, async (req, res) => {
//   try {
//     const { name, keyword, start_date, end_date, color } = req.body;

//     async function getNextId() {
//       return await usePooledConnectionAsync(async (db) => {
//         return await new Promise(async (resolve, reject) => {
//           db.query("SELECT MAX(id) as maxId FROM festivals", (err, result) => {
//             if (err) {
//               reject(err);
//             } else {
//               let nextId = "FEST0001";
//               if (result[0].maxId) {
//                 const currentId = result[0].maxId;
//                 const numericPart = parseInt(currentId.substring(4), 10) + 1;

//                 nextId = "FEST" + numericPart.toString().padStart(4, "0");
//               }
//               resolve(nextId);
//             }
//           });
//         });
//       });
//     }

//     const nextId = await getNextId();

//     await usePooledConnectionAsync(async (db) => {
//       const query =
//         "INSERT INTO festivals (id, name, keywords, start_date, end_date, color) VALUES (?, ?, ?, ?, ?, ?)";
//       const values = [
//         nextId,
//         name,
//         JSON.stringify(keyword),
//         start_date,
//         end_date,
//         color,
//       ];

//       db.query(query, values, (err, results) => {
//         if (err) {
//           console.error("Error inserting festival data:", err);
//           return res
//             .status(500)
//             .json({ error: "Error inserting festival data" });
//         }

//         console.log("Festival data inserted successfully");
//         res.status(200).json({ id: nextId });
//       });
//     });
//   } catch (error) {
//     console.error("Error inserting festival data:", error);
//     return res.status(500).json({ error: "Internal server error" });
//   }
// });

const notifyFarmerNewFestival = async (
  id,
  festname,
  product_name,
  start_date,
  end_date
) => {
  try {
    return await createNotification(
      null,
      id,
      `คุณได้รับคำเชิญให้เข้าร่วมงานเทศกาล "${festname}"`,
      "hi",
      "แจ้งเตือนเข้าร่วม!"
    );
  } catch (error) {
    console.error("Error notifying followers about new festival:", error);
  }
};

app.post("/festival", checkAdmin, async (req, res) => {
  try {
    const {
      festname,
      keyword,
      start_date,
      end_date,
      color = "#50b500",
      everyYear,
    } = req.body;

    async function getNextId() {
      return await usePooledConnectionAsync(async (db) => {
        return await new Promise(async (resolve, reject) => {
          db.query("SELECT MAX(id) as maxId FROM festivals", (err, result) => {
            if (err) {
              reject(err);
            } else {
              let nextId = "FEST0001";
              if (result[0].maxId) {
                const currentId = result[0].maxId;
                const numericPart = parseInt(currentId.substring(4), 10) + 1;

                nextId = "FEST" + numericPart.toString().padStart(4, "0");
              }
              resolve(nextId);
            }
          });
        });
      });
    }
    const nextId = await getNextId();

    async function getNextFarmfestId(index) {
      return await usePooledConnectionAsync(async (db) => {
        return await new Promise(async (resolve, reject) => {
          db.query("SELECT MAX(id) as maxId FROM farmerfest", (err, result) => {
            if (err) {
              reject(err);
            } else {
              let nextfarmfestId = "FMF0001";
              if (result[0].maxId) {
                const currentId = result[0].maxId;
                const numericPart =
                  parseInt(currentId.substring(3), 10) + 1 + index;
                console.log("HIIII" + numericPart);
                nextfarmfestId =
                  "FMF" + numericPart.toString().padStart(4, "0");
              }
              console.log(nextfarmfestId);
              resolve(nextfarmfestId);
            }
          });
        });
      });
    }

    await usePooledConnectionAsync(async (db) => {
      const query =
        "INSERT INTO festivals (id, name, keywords, start_date, end_date, color,everyYear) VALUES (?, ?, ?, ?, ?, ?,?)";
      const values = [
        nextId,
        festname,
        JSON.stringify(keyword),
        start_date,
        end_date,
        color,
        everyYear,
      ];

      let farmerFest = await new Promise(async (resolve, reject) => {
        let querySearch = `
        SELECT f.id ,f.farmerstorename, p.product_name ,p.product_id
        FROM products p 
        INNER JOIN farmers f ON p.farmer_id = f.id 
        WHERE p.available = 1 
      `;
        keyword.forEach((keyword, index) => {
          querySearch += ` ${
            index == 0 ? "and" : "or"
          } p.product_name LIKE '%${keyword}%'`;
        });
        db.query(querySearch, (err, res) => {
          if (err) {
            reject(err);
          } else {
            resolve(res);
          }
        });
      });

      console.log(farmerFest);

      const queryFest = `INSERT INTO farmerfest (festival_id,product_id,is_accept) VALUES ?`;
      const value = farmerFest.map((item) => [
        nextId,
        item.product_id,
        "waiting",
      ]);
      db.query(queryFest, [value], async (err, result) => {
        if (err) {
          console.error("Error inserting festfarm:", err);
          return res
            .status(500)
            .json({ error: "Error inserting festival fest" });
        }
        console.log(result);
        console.log("FestFarm inserted successfully");
      });

      db.query(query, values, async (err, results) => {
        if (err) {
          console.error("Error inserting festival data:", err);
          return res
            .status(500)
            .json({ error: "Error inserting festival data" });
        }

        console.log("Festival data inserted successfully");
        res.status(200).json({ id: nextId });
        for (let index = 0; index < farmerFest.length; index++) {
          const farmerFestival = farmerFest[index];
          let FESTY = await notifyFarmerNewFestival(
            farmerFestival.id,
            festname,
            farmerFest.product_name,
            start_date,
            end_date
          );
          console.log("HI1234", FESTY);
        }
      });
    });
  } catch (error) {
    console.error("Error inserting festival data:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/festivaldetail", checkFarmer, async (req, res) => {
  const token = req.headers.authorization
    ? req.headers.authorization.split(" ")[1]
    : null;
  const decoded = jwt.verify(token, secretKey);

  try {
    await usePooledConnectionAsync(async (db) => {
      const festivalsQuery = `
        SELECT 
          f.id AS farmer_id,
          f.farmerstorename,
          p.product_id,
          p.product_name,
          p.product_description AS description,
            p.category_id,
            p.stock,
            p.price,
            p.unit,
            p.product_image AS image,
            p.product_video AS video,
            p.additional_image AS additionalImage,
            p.certificate,
            p.selectedType AS selectedType,
            p.view_count AS viewCount,
            p.campaign_id AS campaignId,
            p.last_modified AS lastModified,
            p.available,
            p.weight,
            p.selectedStatus AS selectedStatus,
            p.date_reserve_start AS dateReserveStart,
            p.date_reserve_end AS dateReserveEnd,
            p.period,
          ft.name AS festivalName,
          ft.start_date ,
          ft.end_date,
          ft.id AS festivalId,
          ff.id AS farmerfest_id,
          ff.is_accept
        FROM 
          farmerfest ff
        INNER JOIN 
          festivals ft ON ft.id = ff.festival_id
        INNER JOIN 
          products p ON p.product_id = ff.product_id
        INNER JOIN
          farmers f ON f.id = p.farmer_id
        WHERE 
        f.id = ? AND ff.is_accept = 'waiting';
      `;

      const festivalsResults = await new Promise((resolve, reject) => {
        db.query(festivalsQuery, [decoded.ID], (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });

      // Group festivals by festivalId
      const festivalsGrouped = festivalsResults.reduce((acc, festival) => {
        const { festivalId, festivalName, farmer_id, farmerstorename } =
          festival;
        const existingFestival = acc.find((item) => item.id === festivalId);

        if (existingFestival) {
          existingFestival.products.push({
            id: festival.product_id,
            name: festival.product_name,
            farmer_id: farmer_id,
            farmerstorename: farmerstorename,
            description: festival.description,
            category_id: festival.category_id,
            stock: festival.stock,
            price: festival.price,
            unit: festival.unit,
            image: festival.image,
            video: festival.video,
            additionalImage: festival.additionalImage,
            certificate: festival.certificate,
            selectedType: festival.selectedType,
            viewCount: festival.viewCount,
            festivalId: festivalId,
            lastModified: festival.lastModified,
            available: festival.available,
            weight: festival.weight,
            selectedStatus: festival.selectedStatus,
            dateReserveStart: festival.dateReserveStart,
            dateReserveEnd: festival.date,
          });
        } else {
          acc.push({
            id: festivalId,
            title: festivalName,
            is_accept: festival.is_accept,
            date_start: festival.start_date,
            date_end: festival.end_date,
            products: [
              {
                id: festival.product_id,
                name: festival.product_name,
                farmer_id: farmer_id,
                farmerstorename: farmerstorename,
                description: festival.description,
                category_id: festival.category_id,
                stock: festival.stock,
                price: festival.price,
                unit: festival.unit,
                image: festival.image,
                video: festival.video,
                additionalImage: festival.additionalImage,
                certificate: festival.certificate,
                selectedType: festival.selectedType,
                viewCount: festival.viewCount,
                festivalId: festivalId,
                lastModified: festival.lastModified,
                available: festival.available,
                weight: festival.weight,
                selectedStatus: festival.selectedStatus,
                dateReserveStart: festival.dateReserveStart,
                dateReserveEnd: festival.date,
              },
            ],
          });
        }
        return acc;
      }, []);

      res.status(200).json({ success: true, festivals: festivalsGrouped });
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

app.get("/festival", async (req, res) => {
  await usePooledConnectionAsync(async (db) => {
    const query = "SELECT f.* FROM festivals f WHERE available = 1;";

    db.query(query, (err, results) => {
      if (err) {
        console.error("Error fetching festival data:", err);
        return res.status(500).json({ error: "Error fetching festival data" });
      }

      res.status(200).json(results);
    });
  });
});

// Function to check if a festival with the given ID exists
async function checkFestivalExists(id) {
  return await usePooledConnectionAsync(async (db) => {
    return await new Promise(async (resolve, reject) => {
      db.query("SELECT id FROM festivals WHERE id = ?", [id], (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result.length > 0);
        }
      });
    });
  });
}

app.patch("/festival/:id", checkAdmin, async (req, res) => {
  try {
    const festivalId = req.params.id;
    const { name, keyword, start_date, end_date, is_accept } = req.body;

    const festivalExists = await checkFestivalExists(festivalId);
    if (!festivalExists) {
      return res.status(404).json({ error: "Festival not found" });
    }
    await usePooledConnectionAsync(async (db) => {
      let query;
      let values;
      query = festivalExists
        ? "UPDATE festivals SET name = ?, keywords = ?, start_date = ?, end_date = ?  WHERE id = ?"
        : "INSERT INTO festivals (id, name, keywords, start_date, end_date) VALUES (?, ?, ?, ?, ?)";
      values = festivalExists
        ? [name, JSON.stringify(keyword), start_date, end_date, festivalId]
        : [festivalId, name, JSON.stringify(keyword), start_date, end_date];

      db.query(query, values, (err, results) => {
        if (err) {
          console.error("Error updating/inserting festival data:", err);
          return res
            .status(500)
            .json({ error: "Error updating/inserting festival data" });
        }

        console.log("Festival data updated/inserted successfully");
        res
          .status(200)
          .json({ message: "Festival data updated/inserted successfully" });
      });
    });
  } catch (error) {
    console.error("Error updating/inserting festival data:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.delete("/festival/:id", checkAdmin, async (req, res) => {
  try {
    const festivalId = req.params.id;

    const festivalExists = await checkFestivalExists(festivalId);
    if (!festivalExists) {
      return res.status(404).json({ error: "Festival not found" });
    }

    await usePooledConnectionAsync(async (db) => {
      const query = "UPDATE festivals SET available = 0 WHERE id = ?";

      db.query(query, [festivalId], (err, results) => {
        if (err) {
          console.error("Error deleting festival:", err);
          return res.status(500).json({ error: "Error deleting festival" });
        }

        console.log("Festival deleted successfully");
        res
          .status(200)
          .json({ message: "Festival deleted successfully", festivalId });
      });
    });
  } catch (error) {
    console.error("Error deleting festival:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/festival/:id", async (req, res) => {
  try {
    const festivalId = req.params.id;
    await usePooledConnectionAsync(async (db) => {
      // Query to retrieve keywords from festivals

      let query2 = `
        SELECT p.product_id AS id, p.*, f.lat, f.lng, f.farmerstorename, f.shippingcost, f.lastLogin ,ff.is_accept
        FROM farmerfest ff
        INNER JOIN products p ON ff.product_id = p.product_id
        INNER JOIN farmers f ON p.farmer_id = f.id
        where ff.festival_id = ? and p.available = 1
      `;

      db.query(query2, [festivalId], (err, results) => {
        if (err) {
          console.error("Error fetching festival data:", err);
          return res
            .status(500)
            .json({ error: "Error fetching festival data" });
        }
        return res.status(200).json(results);
      });
    });
  } catch (error) {
    console.error("Error fetching festival data:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/todaybuy", checkFarmer, (req, res) => {
  try {
    const token = req.headers.authorization
      ? req.headers.authorization.split(" ")[1]
      : null;

    const decoded = jwt.verify(token, secretKey);
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const formattedDate = `${year}-${month}-${day}`;
    const query = `
    SELECT os.member_id,m.username,oi.product_id, oi.quantity as total_quantity, SUM( oi.price) AS total_price,p.product_name,os.status, c.category_name, p.price
    FROM order_sumary os
    JOIN members m ON os.member_id = m.id
    JOIN order_items oi ON os.id = oi.order_id
    JOIN products p ON oi.product_id = p.product_id
    JOIN farmers f ON p.farmer_id = f.id
    JOIN categories c ON c.category_id = p.category_id
    WHERE DATE(os.date_buys) = ? AND f.id = ? AND p.available = 1
    GROUP BY oi.product_id;
  `;
    console.log(decoded.ID);
    pool.getConnection((err, connection) => {
      if (err) {
        console.error("Error connecting to database:", err);
        return res.status(500).json({ error: "Internal server error" });
      }

      connection.query(query, [formattedDate, decoded.ID], (err, results) => {
        connection.release();

        if (err) {
          console.error("Error fetching today's buyers:", err);
          return res
            .status(500)
            .json({ error: "Error fetching today's buyers" });
        }

        console.log("Today's buyers fetched successfully");
        res.status(200).json(results);
      });
    });
  } catch (error) {
    console.error("Error deleting festival:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/todayreserve", checkFarmer, (req, res) => {
  try {
    const token = req.headers.authorization
      ? req.headers.authorization.split(" ")[1]
      : null;

    const decoded = jwt.verify(token, secretKey);
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const formattedDate = `${year}-${month}-${day}`;
    const query = `
    SELECT r.member_id,m.username, r.status,r.product_id,r.contact, r.quantity AS total_quantity, p.product_name, c.category_name
FROM reserve_products r
JOIN members m ON r.member_id = m.id
JOIN products p ON r.product_id = p.product_id
JOIN farmers f ON p.farmer_id = f.id
JOIN categories c ON c.category_id = p.category_id
WHERE DATE(r.dates) = ? AND f.id = ? AND p.available = 1
GROUP BY r.product_id;
  `;
    console.log(decoded.ID);
    pool.getConnection((err, connection) => {
      if (err) {
        console.error("Error connecting to database:", err);
        return res.status(500).json({ error: "Internal server error" });
      }

      connection.query(query, [formattedDate, decoded.ID], (err, results) => {
        connection.release();

        if (err) {
          console.error("Error fetching today's buyers:", err);
          return res
            .status(500)
            .json({ error: "Error fetching today's buyers" });
        }

        console.log("Today's buyers fetched successfully");
        res.status(200).json(results);
      });
    });
  } catch (error) {
    console.error("Error deleting festival:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/reservetable/:productId", async (req, res) => {
  try {
    await usePooledConnectionAsync(async (db) => {
      let productId = req.params.productId;
      let query = `select rp.contact, m.username, p.product_name, rp.quantity as total_quantity, rp.status from reserve_products rp join members m on rp.member_id = m.id join products p on p.product_id = rp.product_id where rp.product_id = ? and rp.dates >= DATE_SUB(p.period, INTERVAL 1 YEAR) and rp.dates <= p.period order by rp.dates desc;`;
      db.query(query, [productId], (err, result) => {
        if (err) {
          console.error("Error fetching reserve table:", err);
          return res
            .status(500)
            .json({ error: "Error fetching reserve table" });
        }
        console.log("Reserve table fetched successfully");
        res.status(200).json(result);
      });
    });
  } catch (error) {
    console.error("Error deleting festival:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/reserveproduct/:selectedStatus", checkFarmer, async (req, res) => {
  try {
    await usePooledConnectionAsync(async (db) => {
      let selectedStatus = req.params.selectedStatus;
      let token = req.headers.authorization
        ? req.headers.authorization.split(" ")[1]
        : null;
      let decoded = jwt.verify(token, secretKey);
      let injectStatus =
        selectedStatus === "all"
          ? ""
          : `and selectedStatus = "${selectedStatus}"`;
      let query = `select product_id, product_name , period from products where farmer_id = ? and selectedType = 'จองสินค้าผ่านเว็บไซต์' ${injectStatus} and available = 1`;
      db.query(query, [decoded.ID], (err, result) => {
        if (err) {
          console.error("Error fetching reserve product:", err);
          return res
            .status(500)
            .json({ error: "Error fetching reserve product" });
        }
        console.log("Reserve product fetched successfully");
        res.status(200).json(result);
      });
    });
  } catch (error) {
    console.error("Error deleting festival:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/reserveyearly/:productId", checkFarmer, async (req, res) => {
  try {
    await usePooledConnectionAsync(async (db) => {
      let productId = req.params.productId;
      let token = req.headers.authorization
        ? req.headers.authorization.split(" ")[1]
        : null;
      let decoded = jwt.verify(token, secretKey);
      console.log(decoded.ID, productId);
      let query = `select YEAR(dates) as year, SUM(quantity) as count from reserve_products rp join products p on p.product_id = rp.product_id where p.farmer_id = ? and p.product_id = ? and rp.status = "complete" group by year(rp.dates);`;
      db.query(query, [decoded.ID, productId], (err, result) => {
        if (err) {
          console.error("Error fetching reserve yearly:", err);
          return res
            .status(500)
            .json({ error: "Error fetching reserve yearly" });
        }
        console.log("Reserve yearly fetched successfully");
        res.status(200).json(result);
      });
    });
  } catch (error) {
    console.error("Error deleting festival:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});
app.put("/campaign/:id/:product_id", checkFarmer, async (req, res) => {
  try {
    const token = req.headers.authorization
      ? req.headers.authorization.split(" ")[1]
      : null;

    const decoded = jwt.verify(token, secretKey);
    if (decoded.role !== "farmers") {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id, product_id } = req.params;

    const { is_accept } = req.body;
    if (!is_accept) {
      return res.status(400).json({ error: "Action must be specified" });
    }

    let query, values;
    if (is_accept === "accept") {
      query = `UPDATE farmerfest SET is_accept = "accept" WHERE festival_id = ? AND product_id = ? `;
      values = [id, product_id];
    } else if (is_accept === "reject") {
      query = `UPDATE farmerfest SET is_accept = "reject" WHERE festival_id = ? AND product_id = ? `;
      values = [id, product_id];
    } else {
      return res.status(400).json({ error: "Invalid action specified" });
    }

    await usePooledConnectionAsync(async (db) => {
      db.query(query, values, (err, results) => {
        if (err) {
          console.error("Error updating festival data:", err);
          return res
            .status(500)
            .json({ error: "Error updating festival data" });
        }

        console.log("Festival data updated successfully");
        res.status(200).json({
          message: "Festival data updated successfully",
          is_accept: is_accept,
        });
      });
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

app.listen(3006, () => console.log("Avalable 3006"));

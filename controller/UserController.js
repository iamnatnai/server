const secretKey = require("../middleware");
app.get("/getuseradmin/:role/:username", checkAdmin, async (req, res) => {
  const { role, username } = req.params;
  var query;
  if (role !== "farmers") {
    query = `SELECT username, email, firstname, lastname, phone from ${role} where username = "${username}"`;
  } else if (role === "members") {
    query = `SELECT username, email, firstname, lastname, phone, address from ${role} where username = "${username}"`;
  } else {
    query = `SELECT farmerstorename, username, email, firstname, lastname, phone, address, province, amphure, tambon, facebooklink, lineid , lat, lng, zipcode from ${role} where username = "${username}"`;
  }
  await usePooledConnectionAsync(async (db) => {
    db.query(query, (err, result) => {
      if (err) {
        console.log(err);
        res.status(500).send({ exist: false, error: "Internal Server Error" });
      } else {
        console.log(result);
        res.json(result[0]);
      }
    });
  });

  return res.status(200);
});
app.post("/updateinfoadmin", checkAdmin, async (req, res) => {
  const {
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
  } = req.body;
  if (!email || !firstname || !lastname || !phone || !role || !username) {
    return res
      .status(400)
      .json({ success: false, message: "Missing required fields" });
  }
  try {
    var query;
    if (role === "farmers") {
      query = `UPDATE ${role} SET email = "${email}", firstname = "${firstname}", lastname = "${lastname}", phone = "${phone}", address = "${address}", facebooklink = "${facebooklink}" , lineid = "${lineid}", payment = "${payment}", lat = ${
        lat ? `${lat}` : null
      }, lng = ${
        lng ? `${lng}` : null
      }, zipcode = "${zipcode}", farmerstorename = "${farmerstorename}", province = "${province}", amphure="${amphure}", tambon="${tambon}" WHERE username = "${username}"`;
    } else if (role === "members") {
      query = `UPDATE ${role} SET email = "${email}", firstname = "${firstname}", lastname = "${lastname}", phone = "${phone}", address = "${address}" WHERE username = "${username}"`;
    } else {
      query = `UPDATE ${role} SET email = "${email}", firstname = "${firstname}", lastname = "${lastname}", phone = "${phone}" WHERE username = "${username}"`;
    }
    console.log(query);
    await usePooledConnectionAsync(async (db) => {
      db.query(query, (err, result) => {
        if (err) {
          console.log(err);
          res
            .status(500)
            .send({ exist: false, error: "Internal Server Error" });
        } else {
          console.log(result);
          res.json(result[0]);
        }
      });
    });
    return res.status(200);
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
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
      query = `SELECT farmerstorename, username, email, firstname, lastname, phone, address, province, amphure, tambon, payment,facebooklink, lineid , lat, lng, zipcode from ${role} where username = "${username}"`;
    } else if (role === "members") {
      query = `SELECT username, email, firstname, lastname, phone, address from ${role} where username = "${username}"`;
    } else {
      query = `SELECT username, email, firstname, lastname, phone from ${role} where username = "${username}"`;
    }
    console.log(query);
    await usePooledConnectionAsync(async (db) => {
      db.query(query, (err, result) => {
        if (err) {
          console.log(err);
          res
            .status(500)
            .send({ exist: false, error: "Internal Server Error" });
        } else {
          console.log(result);
          res.json(result[0]);
        }
      });
    });

    return res.status(200);
  } catch (error) {
    console.error("Error decoding token:5", error.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/updateinfo", async (req, res) => {
  const token = req.headers.authorization
    ? req.headers.authorization.split(" ")[1]
    : null;
  if (!token) {
    return res.status(400).json({ error: "Token not provided" });
  }
  const {
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
  } = req.body;
  try {
    console.log(req.body);
    let decoded = jwt.verify(token, secretKey);
    const { username, role } = decoded;
    if (role === "farmers") {
      query = `UPDATE ${role} SET email = "${email}", firstname = "${firstname}", lastname = "${lastname}", phone = "${phone}", address = "${address}", facebooklink = "${facebooklink}", lineid = "${lineid}", lat = ${
        lat ? `${lat}` : null
      }, lng = ${
        lng ? `${lng}` : null
      }, zipcode = "${zipcode}", payment = "${payment}", farmerstorename = "${farmerstorename}", province = "${province}", amphure="${amphure}", tambon="${tambon}" WHERE username = "${username}"`;
    } else if (role === "members") {
      query = `UPDATE ${role} SET email = "${email}", firstname = "${firstname}", lastname = "${lastname}", phone = "${phone}" , address = "${address}" WHERE username = "${username}"`;
    } else {
      query = `UPDATE ${role} SET email = "${email}", firstname = "${firstname}", lastname = "${lastname}", phone = "${phone}" WHERE username = "${username}"`;
    }
    console.log(query);
    await usePooledConnectionAsync(async (db) => {
      db.query(query, (err, result) => {
        if (err) {
          console.log(err);
          res
            .status(500)
            .send({ exist: false, error: "Internal Server Error" });
        } else {
          console.log(result);
          res.json(result[0]);
        }
      });
    });

    return res.status(200);
  } catch (error) {
    console.error("Error decoding token:6", error.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});
app.get("/users", async (req, res) => {
  const token = req.headers.authorization
    ? req.headers.authorization.split(" ")[1]
    : null;

  try {
    const decoded = jwt.verify(token, secretKey);
    const role = decoded.role;

    if (role !== "admins" && role !== "tambons") {
      return res.status(401).json({ error: "Unauthorized" });
    }
    await usePooledConnectionAsync(async (db) => {
      if (role === "admins") {
        const adminsQuery =
          "SELECT email, username, firstname, lastname, phone, role FROM admins WHERE available = 1";
        const adminsResult = await new Promise((resolve, reject) => {
          db.query(adminsQuery, (err, result) => {
            if (err) {
              reject(err);
            } else {
              resolve(result);
            }
          });
        });

        const farmersQuery =
          "SELECT email, username, firstname, lastname, phone, role FROM farmers WHERE available = 1";
        const farmersResult = await new Promise((resolve, reject) => {
          db.query(farmersQuery, (err, result) => {
            if (err) {
              reject(err);
            } else {
              resolve(result);
            }
          });
        });
        const membersQuery =
          "SELECT email, username, firstname, lastname, phone, role FROM members WHERE available = 1";
        const membersResult = await new Promise((resolve, reject) => {
          db.query(membersQuery, (err, result) => {
            if (err) {
              reject(err);
            } else {
              resolve(result);
            }
          });
        });

        const providersQuery =
          "SELECT email, username, firstname, lastname, phone, role FROM providers WHERE available = 1";
        const providersResult = await new Promise((resolve, reject) => {
          db.query(providersQuery, (err, result) => {
            if (err) {
              reject(err);
            } else {
              resolve(result);
            }
          });
        });

        const tambonQuery =
          "SELECT email, username, firstname, lastname, phone, role FROM tambons WHERE available = 1";
        const tambonResult = await new Promise((resolve, reject) => {
          db.query(tambonQuery, (err, result) => {
            if (err) {
              reject(err);
            } else {
              resolve(result);
            }
          });
        });

        const admins = adminsResult;
        const farmers = farmersResult;
        const members = membersResult;
        const providers = providersResult;
        const tambon = tambonResult;

        const users = [
          ...admins,
          ...farmers,
          ...members,
          ...providers,
          ...tambon,
        ];

        res.status(200).json(users);
      } else {
        const farmerQuery =
          "SELECT email, username, firstname, lastname, phone, role FROM farmers WHERE available = 1";
        const farmerResult = await new Promise((resolve, reject) => {
          db.query(farmerQuery, (err, result) => {
            if (err) {
              reject(err);
            } else {
              resolve(result);
            }
          });
        });
        res.status(200).json(farmerResult);
      }
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
app.delete("/deleteuser/:role/:username", async (req, res) => {
  const token = req.headers.authorization
    ? req.headers.authorization.split(" ")[1]
    : null;

  const decoded = jwt.verify(token, secretKey);
  if (decoded.role !== "admins" && decoded.role !== "tambons") {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const { role, username } = req.params;
  console.log(role, username);
  if (decoded.role === "tambons" && role !== "farmers") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    //soft delete
    await usePooledConnectionAsync(async (db) => {
      const query = `UPDATE ${role} SET available = 0 WHERE username = "${username}"`;
      await new Promise((resolve, reject) => {
        db.query(query, (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });
    });
    res
      .status(200)
      .json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

async function getNextId() {
  return await usePooledConnectionAsync(async (db) => {
    new Promise(async (resolve, reject) => {
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

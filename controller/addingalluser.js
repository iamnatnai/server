const bcrypt = require("bcrypt");
const { usePooledConnectionAsync } = require("../database");
const { checkIfExistsInAllTables } = require("../middleware");
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
  console.log("role = ", role);
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
            console.log(numericPart);
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
  return await usePooledConnectionAsync(async (db) => {
    new Promise(async (resolve, reject) => {
      db.query(
        "INSERT INTO members (id, username, email, password, firstname, lastname, phone, member_follows, role) VALUES (?, ?, ?, ?, ?, ?, ?,?,?)",
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
        `INSERT INTO ${role} (id,username,email,password,firstname,lastName,phone,role) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
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

const Postaddfarmer = async (req, res) => {
  const { username, email, password, firstName, lastName, tel, lat, lng } =
    req.body;
  if (!username || !email || !password || !firstName || !lastName || !tel) {
    return res
      .status(400)
      .json({ success: false, message: "Missing required fields" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const usernameExists = await checkIfExistsInAllTables("username", username);
    const emailExists = await checkIfExistsInAllTables("email", email);
    if (usernameExists) {
      return res
        .status(409)
        .json({ success: false, message: "Username already exists" });
    }
    if (emailExists) {
      return res
        .status(409)
        .json({ success: false, message: "Email already exists" });
    }
    const nextUserId = await getNextUserId("farmers");
    await insertUser(
      nextUserId,
      username,
      email,
      hashedPassword,
      firstName,
      lastName,
      tel,
      "farmers"
    );
    const query = `INSERT INTO farmers (id, username, email, password, firstname, lastname, phone, lat, lng, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    await usePooledConnectionAsync(async (db) => {
      await new Promise((resolve, reject) => {
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
            lat,
            lng,
            "farmers",
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
    res
      .status(201)
      .json({ success: true, message: "Farmer added successfully" });
  } catch (error) {
    console.error("Error adding farmer:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const Postadduser = async (req, res) => {
  const { username, email, password, firstName, lastName, tel, role } =
    req.body;
  if (
    !username ||
    !email ||
    !password ||
    !firstName ||
    !lastName ||
    !tel ||
    !role
  ) {
    return res
      .status(400)
      .json({ success: false, message: "Missing required fields" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const usernameExists = await checkIfExistsInAllTables("username", username);
    const emailExists = await checkIfExistsInAllTables("email", email);
    if (usernameExists) {
      return res
        .status(409)
        .json({ success: false, message: "Username already exists" });
    }
    if (emailExists) {
      return res
        .status(409)
        .json({ success: false, message: "Email already exists" });
    }
    const nextUserId = await getNextUserId(role);
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
    res.status(201).json({ success: true, message: "User added successfully" });
  } catch (error) {
    console.error("Error adding user:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
const Register = async (req, res) => {
  const { username, email, password, firstName, lastName, tel } = req.body;
  if (!username || !email || !password || !firstName || !lastName || !tel) {
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
    console.log(nextId);

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
};
module.exports = {
  Postaddfarmer,
  Postadduser,
  Register,
};

const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const cors = require('cors');
const bcrypt = require('bcrypt');
const passport = require("passport");
const util = require('util');

const app = express();
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const port = 3000;
const ExtractJwt = require("passport-jwt").ExtractJwt;
const JwtStrategy = require("passport-jwt").Strategy;
const jwt = require('jsonwebtoken');
const secretKey = 'pifOvrart4';
require('dotenv').config();

app.use(cors());
app.use(express.json());

const db = mysql.createConnection({
  host: 'localhost',
  socketPath: process.env.production == "true" ? '/var/run/mysqld/mysqld.sock' : undefined,
  user: process.env.production == "true" ? 'thebestkasetnont' : 'root',
  password: process.env.production == "true" ? 'xGHYb$#34f2RIGhJc' : '',
  database: process.env.production == "true" ? 'thebestkasetnont' : 'kaset_data',
  charset: "utf8mb4",
  typeCast: function (field, next) {
    if (field.type === 'TINY' && field.length === 1) {
      return field.string() === '1'; // 1 = true, 0 = false
    }
    return next();
  },
});

db.connect((err) => {
  if (err) {
    console.error('เกิดข้อผิดพลาดในการเชื่อมต่อกับ MySQL:', err);
  } else {
    console.log('Connencted \n -----------------------------------------');
  }
});

const checkAdmin = (req, res, next) => {
  const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : null;;
  if (!token) {
    return res.status(400).json({ error: 'Token not provided' });
  }
  try {
    const decoded = jwt.verify(token, secretKey);
    if (decoded.role !== 'admins') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();

  } catch (error) {
    console.error('Error decoding token:', error.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

const checkFarmer = (req, res, next) => {
  const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : null;;
  if (!token) {
    return res.status(400).json({ error: 'Token not provided' });
  }
  try {
    const decoded = jwt.verify(token, secretKey);
    console.log(decoded);
    if (decoded.role !== 'farmers' && decoded.role !== 'admins') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();

  } catch (error) {
    console.error('Error decoding token:', error.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}






app.post('/checkinguser', (req, res) => {
  const username = req.body.username;
  console.log('username :', username);
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
        res.status(500).send({ exist: false, error: 'Internal Server Error' });
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

app.post('/checkingemail', (req, res) => {
  const email = req.body.email;
  console.log('email:', email);
  db.query(
    `
    SELECT email FROM admins WHERE email = ?
    UNION
    SELECT email FROM farmers WHERE email = ?
    UNION
    SELECT email FROM members WHERE email = ?
    UNION
    SELECT email FROM providers WHERE email = ?
    UNION
    SELECT email FROM tambons WHERE email = ?
    `,
    [email, email, email, email, email],
    (err, result) => {
      if (err) {
        console.log(err);
        res.status(500).send({ exist: false, error: 'Internal Server Error' });
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


app.post('/register', async (req, res) => {
  const { username, email, password, firstName, lastName, tel } = req.body;

  if (!username || !email || !password || !firstName || !lastName || !tel) {
    return res.status(400).send({ exist: false, error: 'Missing required fields' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const usernameExists = await checkIfExistsInAllTables('username', username);
    const emailExists = await checkIfExistsInAllTables('email', email);

    if (usernameExists) {
      return res.status(409).send({ exist: false, error: 'Username already exists' });
    }

    if (emailExists) {
      return res.status(409).send({ exist: false, error: 'Email already exists' });
    }

    const nextId = await getNextId();

    await insertMember(nextId, username, email, hashedPassword, firstName, lastName, tel);

    res.status(201).send({ exist: true });
  } catch (error) {
    console.error(error);
    res.status(500).send({ exist: false, error: 'Internal Server Error' });
  }
});

async function checkIfExists(role, column, value) {
  return new Promise((resolve, reject) => {
    db.query(`SELECT * FROM ${role} WHERE ${column} = ?`, [value], (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result.length > 0);
      }
    });
  });
}

async function checkIfExistsInAllTables(column, value) {
  const tables = ['admins', 'farmers', 'members', 'providers', 'tambons'];
  const promises = tables.map(table => checkIfExists(table, column, value));
  const results = await Promise.all(promises);
  return results.some(result => result);
}

app.post('/adduser', checkAdmin, async (req, res) => {
  const { username, email, password, firstName, lastName, tel, role } = req.body;
  if (!username || !email || !password || !firstName || !lastName || !tel || !role) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const usernameExists = await checkIfExistsInAllTables('username', username);
    const emailExists = await checkIfExistsInAllTables('email', email);
    if (usernameExists) {
      return res.status(409).json({ success: false, message: 'Username already exists' });
    }
    if (emailExists) {
      return res.status(409).json({ success: false, message: 'Email already exists' });
    }
    const nextUserId = await getNextUserId(role);
    await insertUser(nextUserId, username, email, hashedPassword, firstName, lastName, tel, role);
    res.status(201).json({ success: true, message: 'User added successfully' });
  } catch (error) {
    console.error('Error adding user:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});


app.get('/role', (req, res) => {
  db.query("SELECT 'admins' AS role_id, 'ผู้ดูแลระบบ' AS role_name FROM admins UNION SELECT 'members' AS role_id, 'สมาชิก' AS role_name FROM members UNION SELECT 'farmers' AS role_id, 'เกษตรกร' AS role_name FROM providers UNION SELECT 'providers' AS role_id, 'ผู้ว่าราชการจังหวัด' AS role_name FROM providers UNION SELECT 'tambons' AS role_id, 'เกษตรตำบล' AS role_name FROM tambons;", (err, result) => {
    if (err) {
      console.log(err);
      res.status(500).send({ exist: false, error: 'Internal Server Error' });
    } else {
      res.json(result);
    }
  });
});

app.get('/users', async (req, res) => {
  const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : null;
  const decoded = jwt.verify(token, secretKey);
  const role = decoded.role;

  if (role !== 'admins' && role !== 'tambons') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    if (role === 'admins') {
      const adminsQuery = "SELECT email, username, firstname, lastname, phone, role FROM admins WHERE available = 1";
      const adminsResult = await new Promise((resolve, reject) => {
        db.query(adminsQuery, (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        })
      })

      const farmersQuery = "SELECT email, username, firstname, lastname, phone, role FROM farmers WHERE available = 1";
      const farmersResult = await new Promise((resolve, reject) => {
        db.query(farmersQuery, (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        })
      })

      const membersQuery = "SELECT email, username, firstname, lastname, phone, role FROM members WHERE available = 1";
      const membersResult = await new Promise((resolve, reject) => {
        db.query(membersQuery, (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        })
      })

      const providersQuery = "SELECT email, username, firstname, lastname, phone, role FROM providers WHERE available = 1";
      const providersResult = await new Promise((resolve, reject) => {
        db.query(providersQuery, (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        })
      })

      const tambonQuery = "SELECT email, username, firstname, lastname, phone, role FROM tambons WHERE available = 1";
      const tambonResult = await new Promise((resolve, reject) => {
        db.query(tambonQuery, (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        })
      })

      const admins = adminsResult;
      const farmers = farmersResult;
      const members = membersResult;
      const providers = providersResult;
      const tambon = tambonResult;

      const users = [...admins, ...farmers, ...members, ...providers, ...tambon];

      res.status(200).json(users);
    } else {
      const farmerQuery = "SELECT email, username, firstname, lastname, phone, role FROM farmers WHERE available = 1";
      const farmerResult = await new Promise((resolve, reject) => {
        db.query(farmerQuery, (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        })
      }
      )
      res.status(200).json(farmerResult);
    }
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.delete('/deleteuser/:role/:username', async (req, res) => {
  const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : null;

  const decoded = jwt.verify(token, secretKey);
  if (decoded.role !== 'admins' && decoded.role !== 'tambons') {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const { role, username } = req.params;
  console.log(role, username);
  if (decoded.role === "tambons" && role !== "farmers") {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    //soft delete
    const query = `UPDATE ${role} SET available = 0 WHERE username = "${username}"`
    await new Promise((resolve, reject) => {
      db.query(query, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });

    res.status(200).json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }

});


async function getNextId() {
  return new Promise((resolve, reject) => {
    db.query('SELECT MAX(id) as maxId FROM members', (err, result) => {
      if (err) {
        reject(err);
      } else {
        let nextId = 'MEM00001';
        if (result[0].maxId) {
          const currentId = result[0].maxId;
          const numericPart = parseInt(currentId.substring(3), 10) + 1;

          nextId = 'MEM' + numericPart.toString().padStart(5, '0');
        }
        resolve(nextId);
      }
    });
  });
}
async function getNextUserId(role) {
  let rolePrefix = '';
  switch (role) {
    case 'admins':
      rolePrefix = 'ADMIN';
      break;
    case 'members':
      rolePrefix = 'MEM';
      break;
    case 'farmers':
      rolePrefix = 'FARM';
      break;
    case 'providers':
      rolePrefix = 'PROV';
      break;
    case 'tambons':
      rolePrefix = 'TB';
      break;
  }
  console.log(role);
  return new Promise((resolve, reject) => {
    db.query(`SELECT MAX(id) as maxId FROM ${role}`, (err, result) => {
      if (err) {
        reject(err);
      } else {
        let nextUserId = `${rolePrefix}00001`;
        if (result[0].maxId) {
          const currentId = result[0].maxId;
          const numericPart = parseInt(currentId.substring(rolePrefix.length), 10) + 1;
          console.log(numericPart);
          nextUserId = `${rolePrefix}${numericPart.toString().padStart(5, '0')}`;
        }
        resolve(nextUserId);
      }
    });
  });
}

async function insertMember(memberId, username, email, password, firstName, lastName, tel) {
  return new Promise((resolve, reject) => {
    db.query(
      'INSERT INTO members (id, username, email, password, firstname, lastname, phone, member_follows, role) VALUES (?, ?, ?, ?, ?, ?, ?,?,?)',
      [memberId, username, email, password, firstName, lastName, tel, null, 'members'],
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

async function insertUser(memberId, username, email, password, firstName, lastName, tel, role) {
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

app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).send({ status: false, error: 'Missing required fields' });
  }

  try {
    const user = await getUserByUsername(username);

    if (!user) {
      return res.status(401).send({ status: false, error: 'Invalid username or password' });
    }
    console.log('User:', user.uze_name);
    console.log('Password:', password);
    console.log('Hash Password:', user.pazz);
    console.log('role:', user.role);
    console.log('+++++++++++++++++++++++++++++++++++++++');
    const passwordMatch = await bcrypt.compare(password, user.pazz);

    if (!passwordMatch) {
      console.log("not");
      return res.status(401).send({ status: false, error: 'Invalid username or password' });

    }

    const token = jwt.sign({ username: user.uze_name, ID: user.user_id, role: user.role }, secretKey, {
      expiresIn: '1h',
    });

    console.log('Generated token:', token);

    res.status(200).send({
      status: true,
      memberId: user.user_id,
      username: user.uze_name,
      role: user.role,
      token: token,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ status: false, error: 'Internal Server Error' });
  }
});

app.get('/login', async (req, res) => {
  const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : null;;

  if (!token) {
    return res.status(400).json({ error: 'Token not provided' });
  }
  try {
    const decoded = jwt.verify(token, secretKey);
    const newToken = jwt.sign({ username: decoded.username, ID: decoded.ID, role: decoded.role }, secretKey, {
      expiresIn: '1h',
    });

    return res.status(200).json({ isValid: true, newToken: newToken });
  } catch (error) {
    console.error('Error decoding token:', error.message);
    return res.status(500).json({ error: 'Internal Server Error' });
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
  return new Promise((resolve, reject) => {
    db.query(`
    SELECT 'admins' AS role, id AS user_id, username AS uze_name, password AS pazz FROM admins WHERE username = ? and available = 1
    UNION
    SELECT 'farmers' AS role, id AS user_id, username AS uze_name, password AS pazz FROM farmers WHERE username = ? and available = 1
    UNION
    SELECT 'members' AS role, id AS user_id, username AS uze_name, password AS pazz FROM members WHERE username = ? and available = 1
    UNION
    SELECT 'providers' AS role, id AS user_id, username AS uze_name, password AS pazz FROM providers WHERE username = ? and available = 1
    UNION
    SELECT 'tambons' AS role, id AS user_id, username AS uze_name, password AS pazz FROM tambons WHERE username = ? and available = 1
    `, [username, username, username, username, username], (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result.length > 0 ? result[0] : null);
      }
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




app.get('/categories', (req, res) => {
  db.query("SELECT * FROM categories", (err, result) => {
    if (err) {
      console.log(err);
      res.status(500).send({ exist: false, error: 'Internal Server Error' });
    } else {
      res.json(result);
    }
  });
});

app.post('/categories', checkAdmin, async (req, res) => {
  const { category_id = null, category_name, bgcolor } = req.body;
  if (!category_name || !bgcolor) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  if (!category_id) {
    category_id = await new Promise((resolve, reject) => {
      db.query('SELECT MAX(category_id) as maxId FROM categories', (err, result) => {
        if (err) {
          reject(err);
        } else {
          let nextId = 'CAT0001';
          if (result[0].maxId) {
            const currentIdNumericPart = parseInt(result[0].maxId.substring(3), 10);
            const nextNumericPart = currentIdNumericPart + 1;
            const paddedNextNumericPart = String(nextNumericPart).padStart(4, '0');
            nextId = 'CAT' + paddedNextNumericPart;
          }
          resolve(nextId);
        }
      });
    });
  }

  // find if category_id is exist on database

  const query = 'SELECT * FROM categories WHERE category_id = ?';
  let result = await new Promise((resolve, reject) => {
    db.query(query, [category_id], (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });

  if (result.length > 0) {
    db.query('UPDATE categories SET category_name = ?, bgcolor = ? WHERE category_id = ?', [category_name, bgcolor, category_id], (err, result) => {
      if (err) {
        console.error('Error updating category:', err);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
      } else {
        return res.status(200).json({ success: true, message: 'Category updated successfully' });
      }
    });
  }
  else {
    db.query('INSERT INTO categories (category_id, category_name, bgcolor) VALUES (?, ?, ?)', [category_id, category_name, bgcolor], (err, result) => {
      if (err) {
        console.error('Error adding category:', err);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
      } else {
        return res.status(201).json({ success: true, message: 'Category added successfully' });
      }
    });
  }




});

app.get('/producttypes', (req, res) => {
  db.query("SELECT * FROM product_types", (err, result) => {
    if (err) {
      console.log(err);
      res.status(500).send({ exist: false, error: 'Internal Server Error' });
    } else {
      res.json(result);
    }
  });
});
app.get('/standardproducts', (req, res) => {
  db.query("SELECT * FROM standard_products", (err, result) => {
    if (err) {
      console.log(err);
      res.status(500).send({ exist: false, error: 'Internal Server Error' });
    } else {
      res.json(result);
    }
  });
});


function checkIfEmailAndNameMatch(email, firstName, lastName) {
  return new Promise((resolve, reject) => {
    const query = 'SELECT * FROM members WHERE email = ? AND firstname = ? AND lastname = ?';
    db.query(query, [email, firstName, lastName], (err, result) => {
      if (err) {
        console.error('Error checking email and name in database:', err);
        reject(err);
      } else {
        if (result.length > 0) {
          resolve(true);
        } else {
          resolve(false);
        }
      }
    });
  });
}

app.post('/forgot', async (req, res) => {
  const { email, firstName, lastName } = req.body;

  try {
    const isMatch = await checkIfEmailAndNameMatch(email, firstName, lastName);

    if (isMatch) {
      const newPassword = generateRandomPassword();

      sendNewPasswordByEmail(email, newPassword);


      updatePasswordInDatabase(email, newPassword);

      res.json({ name: 'true' });
    } else {
      res.json({ name: 'false' });
    }
  } catch (error) {
    console.error('Error in forgot endpoint:', error);
    res.status(500).json({ name: 'false' });
  }
});

function generateRandomPassword() {

  const length = 10;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let newPassword = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    newPassword += charset[randomIndex];
  }
  return newPassword;
}

function sendNewPasswordByEmail(email, newPassword) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'thebestkasetnont@gmail.com',
      pass: 'ggtf brgm brip mqvq',
    },
  });

  const mailOptions = {
    from: 'thebestkasetnont@gmail.com',
    to: email,
    subject: 'Your New Password',
    text: `Your new password is: ${newPassword}`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('Error sending email:', error);
    } else {
      console.log('Email sent:', info.response);
    }
  });
}
function hashPassword(password) {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

async function updatePasswordInDatabase(email, newPassword) {
  try {

    const hashedPassword = await hashPassword(newPassword);

    db.query('UPDATE members SET password = ? WHERE email = ?', [hashedPassword, email], (err, result) => {
      if (err) {
        console.error('Error updating password in database:', err);
      } else {
        console.log('Password updated in database');
      }
    });
  } catch (error) {
    console.error('Error hashing password:', error);
  }
}

app.get('/standardproducts', (req, res) => {
  db.query("SELECT * FROM standard_products", (err, result) => {
    if (err) {
      console.log(err);
      res.status(500).send({ exist: false, error: 'Internal Server Error' });
    } else {
      res.json(result);
    }
  });
});
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = './uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const originalname = file.originalname.split('.')[0];
    const extension = file.originalname.split('.')[1];
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${originalname}-${uniqueSuffix}.${extension}`);
  },
});
async function getNextProductId() {
  return new Promise((resolve, reject) => {
    db.query('SELECT MAX(product_id) as maxId FROM products', (err, result) => {
      if (err) {
        reject(err);
      } else {
        let nextId = 'PROD001';
        if (result[0].maxId) {
          const currentIdNumericPart = parseInt(result[0].maxId.substring(4), 10);
          const nextNumericPart = currentIdNumericPart + 1;
          const paddedNextNumericPart = String(nextNumericPart).padStart(3, '0');
          nextId = 'PROD' + paddedNextNumericPart;
        }
        resolve(nextId);
      }
    });
  });
}
const upload = multer({ storage: storage });

app.post('/addproduct', checkFarmer, upload.fields([{ name: 'productImage', maxCount: 1 }, { name: 'productVideo', maxCount: 1 }, { name: 'additionalImages' }, { name: 'cercificationImage' },]), async (req, res) => {
  const {
    username,
    productName,
    category,
    description,
    selectedStandard,
    selectedType,
    price,
    unit,
    stock,
  } = req.body;

  const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : null;;
  if (username !== jwt.verify(token, secretKey).username) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    const farmerIdQuery = "SELECT id FROM farmers WHERE username = ?";
    const farmerIdResult = await new Promise((resolve, reject) => {
      db.query(farmerIdQuery, [username], (err, result) => {
        if (err) {
          console.error('Error checking email and name in database:', err);
          reject(err);
        } else {
          resolve(result)
        }
      });
    });
    const farmerId = farmerIdResult[0].id;

    const nextProductId = await getNextProductId();
    const productImagePath = `./uploads/${req.files['productImage'][0].filename}`;
    const productVideoFile = req.files['productVideo'] ? req.files['productVideo'][0] : null;
    const productVideoPath = productVideoFile ? `./uploads/${productVideoFile.filename}` : null;
    const additionalImagesPaths = req.files['additionalImages'] ? req.files['additionalImages'].map(file => `./uploads/${file.filename}`) : null;
    const additionalImagesJSON = additionalImagesPaths ? JSON.stringify(additionalImagesPaths) : null;
    const cercificationImagePath = req.files['cercificationImage'] ? req.files['cercificationImage'].map(file => `./uploads/${file.filename}`) : null;
    console.log(cercificationImagePath);
    const jsonselectstandard = JSON.parse(selectedStandard).map((standard, index) => ({
      ...standard,
      standard_cercification: cercificationImagePath ? cercificationImagePath[index] : null
    }));
    console.log(jsonselectstandard);
    // if (Array.isArray(selectedStandard)) {
    //   // ตรวจสอบและใช้งาน selectedStandard ได้ตามปกติ
    //   const combinedData = JSON.stringify(selectedStandard.map(standard => ({
    //     ...standard,
    //     cercificationImagePath
    //   })));
    // } else {
    //   // กรณี selectedStandard ไม่ใช่ array
    //   console.error('selectedStandard is not an array');
    // }

    const query = `
  INSERT INTO products (product_id, farmer_id, product_name, product_description, category_id, stock, price, unit, product_image, product_video, additional_image,selectedType,certificate, last_modified)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
`;
    await db.query(query, [nextProductId, farmerId, productName, description, category, stock, price, unit, productImagePath, productVideoPath, additionalImagesJSON, selectedType, JSON.stringify(jsonselectstandard)]);

    res.status(200).send({ success: true, message: 'Product added successfully' });
  } catch (error) {
    console.error('Error adding product:', error);
    res.status(500).send({ success: false, message: 'Internal Server Error' });
  }
});

app.get('/getimage/:image', (req, res) => {
  const image = req.params.image;
  res.sendFile(path.join(__dirname, 'uploads', image));
});

app.get('/getproduct/:id', (req, res) => {
  const id = req.params.id;
  db.query('SELECT * FROM products WHERE product_id = ? and available = 1', [id], (err, result) => {
    if (err) {
      console.log(err);
      res.status(500).send({ exist: false, error: 'Internal Server Error' });
    } else {
      res.json(result[0]);
    }
  });
});

app.get('/getproducts', (req, res) => {
  const { search, category, page, sort, order } = req.query;
  let perPage = 40;
  let queryMaxPage = `SELECT COUNT(*) as maxPage FROM products where available = 1 and ${search !== "" ? `${"product_name LIKE '%" + search + "%' AND"}` : ''} category_id = '${category}'`;
  let query = `SELECT * FROM products where available = 1 and ${search !== "" ? `${"product_name LIKE '%" + search + "%' AND"}` : ''} category_id = '${category}' ORDER BY ${sort} ${order} LIMIT 10 OFFSET ${page * perPage}`;
  if (category == '') {
    queryMaxPage = `SELECT COUNT(*) as maxPage FROM products where available = 1 ${search !== "" ? `${`${"product_name LIKE '%" + search + "%' AND"}`}` : ''}`;
    query = `SELECT * FROM products where available = 1 ${search !== "" ? `${"and product_name LIKE '%" + search + "%'"}` : ''} ORDER BY ${sort} ${order} LIMIT 10 OFFSET ${page * perPage} `;
  }

  let maxPage = new Promise((resolve, reject) => {
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
      res.status(500).send({ exist: false, error: 'Internal Server Error' });
    } else {
      res.json({ products: result, maxPage: maxPage % perPage === 0 ? maxPage / perPage : Math.floor(maxPage / perPage) + 1 });
    }
  });

});

app.delete('/deleteproduct/:id', checkFarmer, async (req, res) => {
  const { id } = req.params;
  const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : null;;
  const decoded = jwt.verify(token, secretKey);
  console.log(decoded.ID);

  //soft delete
  db.query(`UPDATE products SET available = 0 WHERE product_id = "${id}" and farmer_id = "${decoded.ID}"`, (err, result) => {
    if (err) {
      console.log(err);
      res.status(500).send({ exist: false, error: 'Internal Server Error' });
    } else {
      res.json({ success: true });
    }
  });
});

app.get('/updateview/:id', (req, res) => {
  const { id } = req.params;
  // update view_count + 1
  console.log(id);
  db.query('UPDATE products SET view_count = view_count + 1 WHERE product_id = ?', [id], (err, result) => {
    if (err) {
      console.log(err);
      res.status(500).send({ exist: false, error: 'Internal Server Error' });
    } else {
      res.json({ success: true });
    }
  });
})

app.get('/myproducts/:username', (req, res) => {
  const { username } = req.params;
  db.query('SELECT product_id, product_image, product_description, product_name, selectedType, last_modified, price, view_count FROM products WHERE available = 1 and farmer_id COLLATE utf8mb4_general_ci = (select id from farmers where username = ?)', [username], (err, result) => {
    if (err) {
      console.log(err);
      res.status(500).send({ exist: false, error: 'Internal Server Error' });
    } else {
      res.json(result);
    }
  });
});

app.get("/getinfo", (req, res) => {
  const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : null;;

  if (!token) {
    return res.status(400).json({ error: 'Token not provided' });
  }
  try {
    const decoded = jwt.verify(token, secretKey);
    const { username, role } = decoded
    var query
    if (role !== "farmers") {
      query = `SELECT username, email, firstname, lastname, phone from ${role} where username = "${username}"`
    }
    else {
      query = `SELECT farmerstorename, username, email, firstname, lastname, phone, address, province, amphure, tambon, facebooklink, lineid , lat, lng, zipcode from ${role} where username = "${username}"`

    }
    db.query(query, (err, result) => {
      if (err) {
        console.log(err);
        res.status(500).send({ exist: false, error: 'Internal Server Error' });
      } else {
        console.log(result);
        res.json(result[0]);
      }
    });

    return res.status(200);
  } catch (error) {
    console.error('Error decoding token:', error.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
})

app.post('/updateinfo', async (req, res) => {
  const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : null;;
  if (!token) {
    return res.status(400).json({ error: 'Token not provided' });
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
    province = null,
    amphure = null,
    tambon = null,
  } = req.body;
  try {

    var query
    if (role !== "farmers") {
      query = `UPDATE ${role} SET email = "${email}", firstname = "${firstname}", lastname = "${lastname}", phone = "${phone}" WHERE username = "${username}"`
    }
    else {
      query = `UPDATE ${role} SET email = "${email}", firstname = "${firstname}", lastname = "${lastname}", phone = "${phone}", address = "${address}", facebooklink = "${facebooklink}", lineid = "${lineid}", lat = "${lat}", lng = "${lng}", zipcode = "${zipcode}", farmerstorename = "${farmerstorename}", province = "${province}", amphure="${amphure}", tambon="${tambon}" WHERE username = "${username}"`
    }
    console.log(query);
    db.query(query, (err, result) => {
      if (err) {
        console.log(err);
        res.status(500).send({ exist: false, error: 'Internal Server Error' });
      } else {
        console.log(result);
        res.json(result[0]);
      }
    });

    return res.status(200);
  }
  catch (error) {
    console.error('Error decoding token:', error.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
})

app.post("/updateinfoadmin", checkAdmin, (req, res) => {
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
    role = null,
  } = req.body;
  if (!email || !firstname || !lastname || !phone || !role || !username) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }
  try {
    var query
    if (role !== "farmers") {
      query = `UPDATE ${role} SET email = "${email}", firstname = "${firstname}", lastname = "${lastname}", phone = "${phone}" WHERE username = "${username}"`
    }
    else {
      query = `UPDATE ${role} SET email = "${email}", firstname = "${firstname}", lastname = "${lastname}", phone = "${phone}", address = "${address}", facebooklink = "${facebooklink}" , lineid = "${lineid}", lat = "${lat}", lng = "${lng}", zipcode = "${zipcode}", farmerstorename = "${farmerstorename}", province = "${province}", amphure="${amphure}", tambon="${tambon}" WHERE username = "${username}"`
    }
    console.log(query);
    db.query(query, (err, result) => {
      if (err) {
        console.log(err);
        res.status(500).send({ exist: false, error: 'Internal Server Error' });
      } else {
        console.log(result);
        res.json(result[0]);
      }
    });

    return res.status(200);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

app.get("/getuseradmin/:role/:username", checkAdmin, (req, res) => {

  const { role, username } = req.params;
  var query
  if (role !== "farmers") {
    query = `SELECT username, email, firstname, lastname, phone from ${role} where username = "${username}"`
  }
  else {
    query = `SELECT farmerstorename, username, email, firstname, lastname, phone, address, province, amphure, tambon, facebooklink, lineid , lat, lng, zipcode from ${role} where username = "${username}"`

  }
  db.query(query, (err, result) => {
    if (err) {
      console.log(err);
      res.status(500).send({ exist: false, error: 'Internal Server Error' });
    } else {
      console.log(result);
      res.json(result[0]);
    }
  });

  return res.status(200);


});

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


app.post('/checkout', async (req, res) => {
  const { cartList } = req.body;
  var SUMITNOW = 0
  const { order_id, member_id } = req.body; // Assuming you have order_id and member_id in the request body
  if (!cartList || !Array.isArray(cartList) || cartList.length === 0) {
    return res.status(400).json({ success: false, message: 'Empty or invalid cart data' });
  }

  try {
    const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : null;;
    const decoded = jwt.verify(token, secretKey);
    console.log();
    await new Promise((resolve, reject) => {
      db.beginTransaction(err => {
        if (err) reject(err);
        else resolve();
      });
    });


    async function getNextORDID() {
      return new Promise((resolve, reject) => {
        db.query('SELECT MAX(id) as maxId FROM order_sumary', (err, result) => {
          if (err) {
            reject(err);
          } else {
            let ORDNXT = 'ORD00001';
            if (result[0].maxId) {
              const currentId = result[0].maxId;
              console.log(currentId);
              const numericPart = parseInt(currentId.substring(3), 10) + 1;
              console.log(numericPart);
              ORDNXT = 'ORD' + numericPart.toString().padStart(5, '0');
            }
            resolve(ORDNXT);
          }
        });
      });
    }
    const ORDNXT = await getNextORDID();

    for (const item of cartList) {
      const { product_id, amount } = item;
      console.log(decoded);
      const getProductQuery = 'SELECT stock FROM products WHERE product_id = ?';
      const [product] = await new Promise((resolve, reject) => {
        db.query(getProductQuery, [product_id], (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });
      const getProductPriceQuery = 'SELECT price FROM products WHERE product_id = ?';
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
      console.log("this");
      console.log(result.price);
      const price = result.price;
      const totalProductPrice = price * amount;
      SUMITNOW = SUMITNOW + totalProductPrice

      if (!product || product.length === 0) {
        console.error(`Product ID ${product_id} not found`);
        return res.status(400).send({ error: `Product ID ${product_id} not found` });
      }
      if (amount <= 0) {
        console.error(`Insufficient stock for product ID ${product_id}`);
        return res.status(400).send({ error: `NOT TRUE` });
      }

      const currentStock = product.stock; // Corrected to access the stock property
      if (amount > currentStock) {
        console.error(`Insufficient stock for product ID ${product_id}`);
        return res.status(400).send({ error: `Insufficient stock for product ID ${product_id}` });
      }

      const newStock = currentStock - amount;
      const updateStockQuery = 'UPDATE products SET stock = ? WHERE product_id = ?';
      await new Promise((resolve, reject) => {
        db.query(updateStockQuery, [newStock, product_id], (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });
      async function getNextItemId() {
        return new Promise((resolve, reject) => {
          db.query('SELECT MAX(item_id) as maxId FROM order_items', (err, result) => {
            if (err) {
              reject(err);
            } else {
              let nextId = 'ITEM00001';
              if (result[0].maxId) {
                const currentId = result[0].maxId;
                console.log(currentId);
                const numericPart = parseInt(currentId.substring(4), 10) + 1;
                console.log(numericPart);
                nextId = 'ITEM' + numericPart.toString().padStart(5, '0');
              }
              resolve(nextId);
            }
          });
        });
      }
      console.log("++++++");
      console.log(decoded.ID);
      const nextitemId = await getNextItemId();
      const insertOrderVB = 'INSERT INTO order_sumary (id,status,total_amount,member_id,date_buys) VALUES (?,?,?,?,NOW())';
      await new Promise((resolve, reject) => {
        db.query(insertOrderVB, [ORDNXT, "waiting", SUMITNOW, decoded.ID], (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
          console.log("ORDNXT", ORDNXT);
        });
      });
      const insertOrderItemQuery = 'INSERT INTO order_items (item_id,product_id,order_id,price, amount) VALUES (?,?,?,?,?)';
      await new Promise((resolve, reject) => {
        db.query(insertOrderItemQuery, [nextitemId, product_id, ORDNXT, totalProductPrice, amount], (err, result) => {
          if (err) {
            reject(err);
          } else {

            resolve(result);
          }
          console.log("nextitemId");
          console.log(nextitemId);

        });
      });
    }



    await new Promise((resolve, reject) => {
      db.commit(err => {
        if (err) {
          db.rollback(() => {
            reject(err);
          });
        } else {
          resolve();
        }
      });
    });

    res.status(200).json({ success: true, message: 'Checkout completed' });
  } catch (error) {
    console.error('Error during checkout:', error);

    // Rollback transaction
    await new Promise((resolve, reject) => {
      db.rollback(err => {
        if (err) {
          reject(err);
        } else {
          console.log('Transaction rolled back.');
          resolve();
        }
      });
    });

    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});


app.post('/farmerorder', async (req, res) => {
  try {
    const { order_id, status } = req.body;
    async function addComment(order_id, comment) {
      const insertCommentQuery = 'UPDATE order_sumary SET comment = ? WHERE id = ?';
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
    const updateDonedate = 'UPDATE order_sumary SET date_complete = NOW() WHERE id = ?';
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
      return res.status(400).json({ success: false, message: 'Incomplete request data' });
    }
    if (status === "reject") {
      const { comment } = req.body;
      if (!comment) {
        return res.status(400).json({ success: false, message: 'Comment is required for rejection' });
      }
      await addComment(order_id, comment);
    }
    // Update order status in the database
    const updateOrderStatusQuery = 'UPDATE order_sumary SET status = ? WHERE id = ?';
    await new Promise((resolve, reject) => {
      db.query(updateOrderStatusQuery, [status, order_id], (err, result) => {
        if (err) {
          reject(err);
        } else {
          if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Order not found' });
          }
          resolve(result);
        }
      });
    });

    return res.status(200).json({ success: true, message: 'Order status updated successfully' });
  } catch (error) {
    console.error('Error updating order status:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});


app.get('/orderlist', async (req, res) => {
  try {
    const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : null;
    const decoded = jwt.verify(token, secretKey);
    const orderQuery = 'SELECT * FROM order_sumary WHERE member_id = ?';
    const orders = await new Promise((resolve, reject) => {
      db.query(orderQuery, [decoded.ID], (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
    res.status(200).json({ success: true, orders: orders });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});
app.post('/confirmtrancsaction', upload.fields([{ name: 'productSlip', maxCount: 1 }]), async (req, res) => {
  try {
    const productSlipFile = req.files['productSlip'] ? req.files['productSlip'][0] : null;
    
    const productSlipPath = productSlipFile ? `./uploads/${productSlipFile.filename}` : null;

    const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : null;
    const decoded = jwt.verify(token, secretKey);

    // Check if product slip file exists in the request
    if (!productSlipFile) {
      return res.status(400).json({ success: false, message: 'Product slip file is required' });
    }
    
    // Extract order_id from the request
    const { order_id } = req.body;

    const orderQuery = 'UPDATE order_sumary SET transaction_confirm = ? ,status = ? WHERE id = ? AND member_id = ?';
    const updatedOrders = await new Promise((resolve, reject) => {
      db.query(orderQuery, [productSlipPath, 'pending', order_id, decoded.ID], (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
    
    // Return success response with the updated orders
    res.status(200).json({ success: true, message: 'Order transaction confirmation updated successfully', orders: updatedOrders });
  } catch (error) {
    // Handle errors
    console.error('Error updating order transaction confirmation:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});









app.get('/farmerorder', async (req, res) => {
  try {
    const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : null;
    const decoded = jwt.verify(token, secretKey);
    const orderItemsQuery = `
    SELECT oi.order_id, oi.product_id, oi.amount, oi.price, 
    os.total_amount, os.transaction_confirm, os.date_buys, os.date_complete, os.status, 
    m.firstname, m.lastname, m.phone, m.address
    FROM order_items oi
    INNER JOIN order_sumary os ON oi.order_id = os.id
    INNER JOIN members m ON os.member_id = m.id
    INNER JOIN products p ON oi.product_id = p.product_id
    INNER JOIN farmers f ON p.farmer_id = f.id
    WHERE f.id = ?
    `;
    const orderItemsResult = await new Promise((resolve, reject) => {
      db.query(orderItemsQuery, [decoded.ID], (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });

    const farmerOrdersMap = new Map();
    orderItemsResult.forEach(orderItem => {
      const order_id = orderItem.order_id;
      if (!farmerOrdersMap.has(order_id)) {
        farmerOrdersMap.set(order_id, {
          order_id: order_id,
          products: [],
          total_amount: orderItem.total_amount,
          transaction_confirm: orderItem.transaction_confirm,
          customer_info: {
            member_id: orderItem.member_id,
            first_name: orderItem.first_name,
            last_name: orderItem.last_name,
            phone: orderItem.phone,
            address: orderItem.address
          },
          date_buys: new Date(orderItem.date_buys).toLocaleString(),
          date_complete: orderItem.date_complete,
          status: orderItem.status
        });
      }
      farmerOrdersMap.get(order_id).products.push({
        product_id: orderItem.product_id,
        amount: orderItem.amount,
        price: orderItem.price
      });
    });

    const farmerOrders = Array.from(farmerOrdersMap.values());
    res.json(farmerOrders);
  } catch (error) {
    console.error('Error fetching farmer orders:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});


app.get('/comment', async (req, res) => {
  const { rating, comment, product_id } = req.body;
  const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : null;
  const decoded = jwt.verify(token, secretKey);

  // Function to get the next review ID
  async function getNextReviewId() {
    return new Promise((resolve, reject) => {
      db.query('SELECT MAX(review_id) as maxId  FROM product_reviews', (err, result) => {
        if (err) {
          reject(err);
        } else {
          let nextRev = 'REV0000001';
          if (result[0].maxId) {
            const currentId = result[0].maxId;
            const numericPart = parseInt(currentId.substring(3), 10) + 1;
            nextRev = 'REV' + numericPart.toString().padStart(7, '0');
          }
          resolve(nextRev);
        }
      });
    });
  }

  // Check if all necessary data is provided
  if (!decoded.ID || !comment || !product_id || !rating) {
    return res.status(400).json({ success: false, message: 'Incomplete comment data' });
  }

  // Check if rating is valid
  if (rating < 1 || rating > 5) {
    return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
  }

  try {
    // Check if the member has purchased the product
    const checkOrderQuery = 'SELECT os.id AS order_id FROM order_sumary os INNER JOIN order_items oi ON os.id = oi.order_id WHERE os.member_id = ? AND oi.product_id = ?';
    const [orderResult] = await new Promise((resolve, reject) => {
      db.query(checkOrderQuery, [decoded.ID, product_id], (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });

    const checkDuplicateOrderQuery = 'SELECT * FROM product_reviews WHERE order_id = ?';
    const duplicateOrders = await new Promise((resolve, reject) => {
      db.query(checkDuplicateOrderQuery, [orderResult.order_id], (err, result) => {
        if (err) {
          reject(err);
        } else {
          console.log(result);
          resolve(result);
        }
      });
    });
    if (duplicateOrders.length > 0) {
      return res.status(400).json({ success: false, message: 'Order ID already exists in product reviews' });
    }
    console.log(duplicateOrders);
    if (!orderResult || orderResult.length === 0) {
      return res.status(400).json({ success: false, message: 'Member has not purchased this product' });
    }

    const nextReviewId = await getNextReviewId();

    const insertCommentQuery = 'INSERT INTO product_reviews (review_id, member_id, rating, comment, product_id,order_id) VALUES (?, ?, ?, ?, ?, ?)';
    console.log(orderResult.order_id);
    await new Promise((resolve, reject) => {
      db.query(insertCommentQuery, [nextReviewId, decoded.ID, rating, comment, product_id, orderResult.order_id], (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });

    return res.status(200).json({ success: true, message: 'Comment added successfully' });
  } catch (error) {
    console.error('Error adding comment:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

app.post("/changepassword", async (req, res) => {
  const { oldpassword, newpassword, usernameBody, roleBody } = req.body;
  const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : null;

  const checkMatchPssword = async (role, username, password) => {
    const hashedPassword = await new Promise((resolve, reject) => {
      db.query(`SELECT password FROM ${role} WHERE username = "${username}"`, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result[0].password);
        }
      });
    });

    const passwordMatch = await bcrypt.compare(password, hashedPassword);
    return passwordMatch;
  }
  if (!token) {
    return res.status(400).json({ success: false, message: 'Token not provided' });
  }

  const decoded = jwt.verify(token, secretKey);
  var { role: roleDecoded, username: usernameDecoded } = decoded;

  try {
    // ถ้าไม่ใช่ admin ต้องเช็คว่า password เดิมตรงกับที่อยู่ใน database หรือไม่
    if (roleDecoded !== "admins") {
      if (!await checkMatchPssword(roleDecoded, usernameDecoded, oldpassword)) {
        console.log("Password not match");
        return res.status(400).json({ success: false, message: 'Password not match' });

      }
    }

    const newHashedPassword = await bcrypt.hash(newpassword, 10);

    await new Promise((resolve, reject) => {
      db.query(`UPDATE ${roleDecoded !== "admins" ? roleDecoded : roleBody} SET password = "${newHashedPassword}" WHERE username = "${roleDecoded !== "admins" ? usernameDecoded : usernameBody}"`, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });

    return res.status(200).json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

app.listen(3001, () => console.log('Avalable 3001'));

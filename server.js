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
const { error } = require('console');
const secretKey = 'pifOvrart4';
require('dotenv').config();

app.use(cors());
app.use(express.json());

const db = mysql.createConnection({
  host: 'localhost',
  socketPath: process.env.production == "true" ? '/var/run/mysqld/mysqld.sock' : undefined,
  user: process.env.production == "true" ? 'thebestkasetnont' : 'root',
  password: process.env.production == "true" ? 'xGHYb$#34f2RIGhJc' : '1234',
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
  const secretKey = 'pifOvrart4';
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
  const secretKey = 'pifOvrart4';
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
  db.query("SELECT 'admins' AS role_id, 'ผู้ดูแลระบบ' AS role_name FROM admins UNION SELECT 'members' AS role_id, 'สมาชิก' AS role_name FROM members UNION SELECT 'farmers' AS role_id, 'เกษตรกร' AS role_name FROM providers UNION SELECT 'providers' AS role_id, 'ผู้ว่าราชการจังหวัด' AS role_name FROM providers UNION SELECT 'tambon' AS role_id, 'เกษตรตำบล' AS role_name FROM tambons;", (err, result) => {
    if (err) {
      console.log(err);
      res.status(500).send({ exist: false, error: 'Internal Server Error' });
    } else {
      res.json(result);
    }
  });
});

app.get('/users', checkAdmin, async (req, res) => {
  try {
    const adminsQuery = "SELECT email, username, firstname, lastname, phone, role FROM admins";
    const adminsResult = await new Promise((resolve, reject) => {
      db.query(adminsQuery, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      })
    })

    const farmersQuery = "SELECT email, username, firstname, lastname, phone, role FROM farmers";
    const farmersResult = await new Promise((resolve, reject) => {
      db.query(farmersQuery, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      })
    })

    const membersQuery = "SELECT email, username, firstname, lastname, phone, role FROM members";
    const membersResult = await new Promise((resolve, reject) => {
      db.query(membersQuery, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      })
    })

    const providersQuery = "SELECT email, username, firstname, lastname, phone, role FROM providers";
    const providersResult = await new Promise((resolve, reject) => {
      db.query(providersQuery, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      })
    })

    const tambonQuery = "SELECT email, username, firstname, lastname, phone, role FROM tambons";
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
    console.log(adminsResult);

    res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal Server Error' });
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
      console.log("bad");
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

    const token = jwt.sign({ username: user.uze_name, ID: user.user_id, role: user.role }, 'pifOvrart4', {
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

  const secretKey = 'pifOvrart4';
  try {
    const decoded = jwt.verify(token, secretKey);
    const newToken = jwt.sign({ username: decoded.username, role: decoded.role }, secretKey, {
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
    SELECT 'admins' AS role, id AS user_id, username AS uze_name, password AS pazz FROM admins WHERE username = ?
    UNION
    SELECT 'farmers' AS role, id AS user_id, username AS uze_name, password AS pazz FROM farmers WHERE username = ?
    UNION
    SELECT 'members' AS role, id AS user_id, username AS uze_name, password AS pazz FROM members WHERE username = ?
    UNION
    SELECT 'providers' AS role, id AS user_id, username AS uze_name, password AS pazz FROM providers WHERE username = ?
    UNION
    SELECT 'tambons' AS role, id AS user_id, username AS uze_name, password AS pazz FROM tambons WHERE username = ?
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
  const secretKey = 'pifOvrart4';
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
  db.query('SELECT * FROM products WHERE product_id = ?', [id], (err, result) => {
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
  console.log(category, page, sort, order);
  let query = `SELECT * FROM products where ${search !== "" ? `${"product_name LIKE '%" + search + "%' AND"}` : ''} category_id = '${category}' ORDER BY ${sort} ${order} LIMIT 10 OFFSET ${page * 10}`;
  if (category == '') {
    query = `SELECT * FROM products ${search !== "" ? `${"where product_name LIKE '%" + search + "%'"}` : ''} ORDER BY ${sort} ${order} LIMIT 10 OFFSET ${page * 10} `;
  }
  console.log(query);
  db.query(query, (err, result) => {
    if (err) {
      console.log(err);
      res.status(500).send({ exist: false, error: 'Internal Server Error' });
    } else {
      res.json({ products: result, hasMore: result.length === 10 });
    }
  });

});

app.delete('/deleteproduct/:id', checkFarmer, async (req, res) => {
  const { id } = req.params;
  const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : null;;
  const secretKey = 'pifOvrart4';
  const username = jwt.verify(token, secretKey).username;
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
  //soft delete
  db.query('UPDATE products SET isavailable = 0 WHERE product_id = ? and farmer_id =', [id, farmerId], (err, result) => {
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
  db.query('SELECT product_id, product_image, product_description, product_name, selectedType, last_modified, price, view_count FROM products WHERE farmer_id COLLATE utf8mb4_general_ci = (select id from farmers where username = ?)', [username], (err, result) => {
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
  const secretKey = 'pifOvrart4';
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
  const { order_id, member_id } = req.body; // Assuming you have order_id and member_id in the request body
  if (!cartList || !Array.isArray(cartList) || cartList.length === 0) {
    return res.status(400).json({ success: false, message: 'Empty or invalid cart data' });
  }

  try {
    const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : null;;
    const secretKey = 'pifOvrart4';
    const decoded = jwt.verify(token, secretKey);
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
    const insertOrderVB = 'INSERT INTO order_sumary (id,status,member_id,date_buys) VALUES (?,?,?,NOW())';
    await new Promise((resolve, reject) => {
      db.query(insertOrderVB, [ORDNXT, "waiting", decoded.ID], (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
        console.log("ORDNXT", ORDNXT);
      });
    });
    var SUMITNOW = 0
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
      const nextitemId = await getNextItemId();
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

    const UpdateOrderSum = 'UPDATE order_sumary SET total_amount = ? WHERE id = ?';
    await new Promise((resolve, reject) => {
      db.query(UpdateOrderSum, [SUMITNOW, ORDNXT], (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
        console.log(SUMITNOW);
      });
    });

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
app.post('/orderlist', async (req, res) => {
  try {
    const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : null;
    const secretKey = 'pifOvrart4';
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

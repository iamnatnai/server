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
const secretKey = 'sohot';
require('dotenv').config();

app.use(cors());
app.use(express.json());

const db = mysql.createConnection({
  host: 'localhost',
  socketPath: process.env.production == "true" ? '/var/run/mysqld/mysqld.sock' : undefined,
  user: process.env.production == "true" ? 'thebestkasetnont' : 'root',
  password: process.env.production == "true" ? 'xGHYb$#34f2RIGhJc' : '',
  database: process.env.production == "true" ? 'thebestkasetnont' : 'kaset_data',
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

app.post('/checkinguser', (req, res) => {
  const username = req.body.username;
  console.log('username :', username);
  db.query(
    `
    SELECT 'admins' AS role, admin_user AS username FROM admins WHERE admin_user = ?
    UNION
    SELECT 'farmers' AS role, farmer_username AS username FROM farmers WHERE farmer_username = ?
    UNION
    SELECT 'members' AS role, member_username AS username FROM members WHERE member_username = ?
    UNION
    SELECT 'providers' AS role, prov_user AS username FROM providers WHERE prov_user = ?
    UNION
    SELECT 'tambon' AS role, tb_user AS username FROM tambon WHERE tb_user = ?
    `,
    [username, username, username, username, username],
    (err, result) => {
      if (err) {
        console.log(err);
        res.status(500).send({ exist: false, error: 'Internal Server Error' });
      } else {
        if (result.length > 0) {
          res.send({ username: result[0].username, exist: false });
        } else {
          res.send({ username: username, exist: true });
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
    SELECT admin_email AS email FROM admins WHERE admin_email = ?
    UNION
    SELECT farmer_email AS email FROM farmers WHERE farmer_email = ?
    UNION
    SELECT member_email AS email FROM members WHERE member_email = ?
    UNION
    SELECT prov_email AS email FROM providers WHERE prov_email = ?
    UNION
    SELECT tb_email AS email FROM tambon WHERE tb_email = ?
    `,
    [email, email, email, email, email],
    (err, result) => {
      if (err) {
        console.log(err);
        res.status(500).send({ exist: false, error: 'Internal Server Error' });
      } else {
        if (result.length > 0) {
          res.send({ email: result[0].email, exist: false });
        } else {
          res.send({ email: email, exist: true });
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

    const usernameExists = await checkIfExists('member_username', username);
    const emailExists = await checkIfExists('member_email', email);

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

async function checkIfExists(column, value) {
  return new Promise((resolve, reject) => {
    db.query(`SELECT * FROM members WHERE ${column} = ?`, [value], (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result.length > 0);
      }
    });
  });
}
app.get('/role', (req, res) => {
  db.query("SELECT 'admins' AS role_id, 'แอดมิน' AS role_name FROM admins UNION SELECT 'members' AS role_id, 'สมาชิก' AS role_name FROM members UNION SELECT 'providers' AS role_id, 'ผู้ว่าราชการจังหวัด' AS role_name FROM providers UNION SELECT 'tambon' AS role_id, 'เกษตรตำบล' AS role_name FROM tambon;", (err, result) => {
    if (err) {
      console.log(err);
      res.status(500).send({ exist: false, error: 'Internal Server Error' });
    } else {
      res.json(result);
    }
  });
});

app.get('/users', async (req, res) => {
  try {
    const adminsQuery = "SELECT admin_id AS user_id, admin_email AS email, admin_user AS username, admin_first_name AS first_name, admin_last_name AS last_name, admin_number AS phone, role FROM admins";
    const adminsResult = await new Promise((resolve, reject) => {
      db.query(adminsQuery, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      })
    })

    const farmersQuery = "SELECT farmer_id AS user_id, farmer_email AS email, farmer_username AS username, farmer_name AS first_name, '' AS last_name, farmer_phone AS phone, role FROM farmers";
    const farmersResult = await new Promise((resolve, reject) => {
      db.query(farmersQuery, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      })
    })

    const membersQuery = "SELECT member_id AS user_id, member_email AS email, member_username AS username, member_FirstName AS first_name, member_LastName AS last_name, member_phone AS phone, role FROM members";
    const membersResult = await new Promise((resolve, reject) => {
      db.query(membersQuery, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      })
    })

    const providersQuery = "SELECT prov_id AS user_id, prov_email AS email, prov_user AS username, prov_name AS first_name, '' AS last_name, prov_number AS phone, role FROM providers";
    const providersResult = await new Promise((resolve, reject) => {
      db.query(providersQuery, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      })
    })

    const tambonQuery = "SELECT tb_id AS user_id, tb_email AS email, tb_user AS username, tb_first_name AS first_name, tb_last_name AS last_name, tb_number AS phone, role FROM tambon";
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
    db.query('SELECT MAX(member_id) as maxId FROM members', (err, result) => {
      if (err) {
        reject(err);
      } else {
        let nextId = 'MEM001';
        if (result[0].maxId) {
          const currentId = result[0].maxId;
          const numericPart = parseInt(currentId.substring(3), 10) + 1;
          nextId = 'MEM' + numericPart.toString().padStart(3, '0');
        }
        resolve(nextId);
      }
    });
  });
}

async function insertMember(memberId, username, email, password, firstName, lastName, tel) {
  return new Promise((resolve, reject) => {
    db.query(
      'INSERT INTO members (member_id, member_username, member_email, member_password, member_FirstName, member_LastName, member_phone, member_follows) VALUES (?, ?, ?, ?, ?, ?, ?,?)',
      [memberId, username, email, password, firstName, lastName, tel, null],
      (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve();
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

    const token = jwt.sign({ username: user.uze_name, ID: user.user_id, role: user.role }, 'sohot', {
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
  const token = req.headers.authorization.split(' ')[1];

  if (!token) {
    return res.status(400).json({ error: 'Token not provided' });
  }

  const secretKey = 'sohot';
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
    SELECT 'admins' AS role, admin_id AS user_id, admin_user AS uze_name, admin_password AS pazz FROM admins WHERE admin_user = ?
    UNION
    SELECT 'farmers' AS role, farmer_id AS user_id, farmer_username AS uze_name, farmer_password AS pazz FROM farmers WHERE farmer_username = ?
    UNION
    SELECT 'members' AS role, member_id AS user_id, member_username AS uze_name, member_password AS pazz FROM members WHERE member_username = ?
    UNION
    SELECT 'providers' AS role, prov_id AS user_id, prov_user AS uze_name, prov_password AS pazz FROM providers WHERE prov_user = ?
    UNION
    SELECT 'tambon' AS role, tb_id AS user_id, tb_user AS uze_name, tb_password AS pazz FROM tambon WHERE tb_user = ?
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
    const query = 'SELECT * FROM members WHERE member_email = ? AND member_FirstName = ? AND member_LastName = ?';
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

    db.query('UPDATE members SET member_password = ? WHERE member_email = ?', [hashedPassword, email], (err, result) => {
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

app.post('/addproduct', upload.fields([{ name: 'productImage', maxCount: 1 }, { name: 'productVideo', maxCount: 1 }, { name: 'additionalImages' },{ name: 'cercificationImage' },]), async (req, res) => {
  const {
    jwt_token,
    username,
    productName,
    category,
    description,
    productImage,
    productVideo,
    additionalImages,
    selectedStandard,
    standardName,
    standardNumber,
    certification,
    cercificationImage,
    exp,
    selectedType,
    price,
    unit,
    stock,
    amount,
    shippingCost,
    shippingCostList,
    selectedTypeDescription,
    selectedStatus,
    startDate,
    endDate,
    deposit,
  } = req.body;

  try {
    const farmerIdQuery = "SELECT farmer_id FROM farmers WHERE farmer_username = ?";
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
    console.log(farmerIdResult);
    console.log(farmerIdResult[0]);
    console.log(selectedStandard);
    const farmerId = farmerIdResult[0].farmer_id;

    const nextProductId = await getNextProductId();
    const productImagePath = `./uploads/${req.files['productImage'][0].filename}`;
    const productVideoFile = req.files['productVideo'] ? req.files['productVideo'][0] : null;
    const productVideoPath = productVideoFile ? `./uploads/${productVideoFile.filename}` : null;
    console.log(additionalImages);
    console.log(productImagePath);
    console.log(productVideoPath);
    const additionalImagesPaths =req.files['additionalImages'] ? req.files['additionalImages'].map(file => `./uploads/${file.filename}`) : null;
    const additionalImagesJSON = JSON.stringify(additionalImagesPaths);
    const cercificationImagePath = req.files['cercificationImage'] ? req.files['cercificationImage'].map(file => `./uploads/${file.filename}`) : null;
    console.log(cercificationImagePath);
    const jsonselectstandard = JSON.parse(selectedStandard).map((standard,index) => ({
      ...standard,
      standard_cercification: cercificationImagePath[index]
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
  const { category, page } = req.query;
  console.log(category, page);
  let query = `SELECT * FROM products where category_id = '${category}' LIMIT 10 OFFSET ${page * 10}`;
  if (category == '') {
    query = `SELECT * FROM products LIMIT 10 OFFSET ${page * 10} `;
  }

  db.query(query, (err, result) => {
    if (err) {
      console.log(err);
      res.status(500).send({ exist: false, error: 'Internal Server Error' });
    } else {
      res.json({ products: result, hasMore: result.length === 10 });
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



app.listen(3001, () => console.log('Avalable 3001'));

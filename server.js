const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const cors = require('cors');
const bcrypt = require('bcrypt');
const passport = require("passport");
const util = require('util');

const app = express();
const nodemailer = require('nodemailer');
const multer = require('multer'); // ใช้สำหรับจัดการ multipart/form-data (การอัปโหลดไฟล์)
const path = require('path');
const fs = require('fs');
const port = 3000;
const ExtractJwt = require("passport-jwt").ExtractJwt;
const JwtStrategy = require("passport-jwt").Strategy;
const jwt = require('jsonwebtoken');
const secretKey = 'sohot';

app.use(cors());
app.use(express.json());

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'kaset_data',
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
  db.query("SELECT * FROM members WHERE member_username = ?", [username], (err, result) => {
    if (err) {
      console.log(err);
      res.status(500).send({ exist: false, error: 'Internal Server Error' });
    } else {
      if (result.length > 0) {
        res.send({ username: result[0].member_username, same: false });
      } else {
        res.send({ username: username, same: true });
      }
    }
  });
});

app.post('/checkingemail', (req, res) => {
  const email = req.body.email;
  console.log('email:', email);
  db.query("SELECT * FROM members WHERE member_email = ?", [email], (err, result) => {
    if (err) {
      console.log(err);
      res.status(500).send({ same: false, error: 'Internal Server Error' });
    } else {
      if (result.length > 0) {
        res.send({ email: result[0].member_email, same: false });
      } else {
        res.send({ email: email, exist: true });
      }
    }
  });
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
      return res.status(401).send({ status: false, error: 'Invalid username or password' });
    }
console.log('User:',user.uze_name);
console.log('Password:', password);
console.log('Hash Password:', user.pazz);
console.log('role:', user.role);
console.log('+++++++++++++++++++++++++++++++++++++++');
const passwordMatch = await bcrypt.compare(password, user.pazz);

    if (!passwordMatch) {
      return res.status(401).send({ status: false, error: 'Invalid username or password' });
    }

    const token = jwt.sign({username: user.uze_name,ID : user.user_id, role: user.role }, 'sohot', {
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

app.post('/decodeX', async (req, res,descode) => {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(400).json({ error: 'Token not provided' });
  }

  const secretKey = 'sohot';

  try {
    const decoded = jwt.verify(token, secretKey);
    console.log('Decoded token:', decoded);
    // res.json(decoded);
    descode()
  } catch (error) {
    console.error('Error decoding token:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
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
        // ถ้ามีข้อมูลที่ตรงกัน
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
    // Hash the new password
    const hashedPassword = await hashPassword(newPassword);

    // Update the password in the database
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
    // สร้างชื่อไฟล์ใหม่โดยเพิ่มตัวเลขหลังชื่อไฟล์ในกรณีที่มีชื่อไฟล์ซ้ำ
    const originalname = file.originalname.split('.')[0];
    const extension = file.originalname.split('.')[1];
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${originalname}-${uniqueSuffix}.${extension}`);
  },
});

const upload = multer({ storage: storage });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post('/addproduct', upload.fields([{ name: 'productImage', maxCount: 1 }, { name: 'additionalImages' }]), async (req, res) => {
  const {
    productName,
    categoryName,
    productImage,
    productVideo,
    additionalImages,
    description,
    standardName,
    
    standardNumber,
    certification,
    selectedDate,
    selectedType,
    selectedTypeDescription,
  } = req.body;

  try {
    // 1. บันทึก productImage ลงในเซิร์ฟเวอร์หรือฐานข้อมูล
    const productImagePath = `./uploads/${req.files['productImage'][0].filename}`;
    const query = `
      INSERT INTO products (farmer_id, product_name, product_description, category_id, quantity_available, price_per_unit, unit, product_image, last_modified)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    // Execute the query with the corresponding values
    await db.query(query, [farmerId, productName, description, categoryId, quantityAvailable, pricePerUnit, unit, productImagePath]);

    // 3. บันทึกที่อยู่ของไฟล์ additionalImages หากมี
    if (additionalImages && additionalImages.length > 0) {
      // สร้างอาร์เรย์เพื่อเก็บที่อยู่ของไฟล์ additionalImages
      const additionalImagesPaths = [];

      // วนลูปเพื่อประมวลผลทุกไฟล์ additionalImages
      for (const file of req.files['additionalImages']) {
        const filePath = `./uploads/${file.filename}`;
        additionalImagesPaths.push(filePath);

        // ตัวอย่าง: บันทึกที่อยู่ไฟล์ลงในฐานข้อมูลสำหรับทุกไฟล์ additionalImages
        // await insertAdditionalImageToDatabase(filePath);
      }
    }

    res.status(200).send({ success: true, message: 'เพิ่มผลผลิตเรียบร้อยแล้ว' });
  } catch (error) {
    console.error('Error adding product:', error);
    res.status(500).send({ success: false, message: 'Internal Server Error' });
  }
});

app.listen(3001, () => console.log('Avalable 3001'));

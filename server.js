const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const cors = require('cors');
const bcrypt = require('bcrypt');
const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'kaset_data',
});

db.connect((err) => {
  if (err) {
    console.error('เกิดข้อผิดพลาดในการเชื่อมต่อกับ MySQL:', err);
  } else {
    console.log('Connencted');
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
      'INSERT INTO members (member_id, member_username, member_email, member_password, member_name, member_phone, member_follows) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [memberId, username, email, password, firstName + ' ' + lastName, tel, null],
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

    const passwordMatch = await bcrypt.compareSync(password, user.member_password);

    if (!passwordMatch) {
      return res.status(401).send({ status: false, error: 'Invalid username or password' });
    }

    res.status(200).send({ status: true, memberId: user.member_id, username: user.member_username });
  } catch (error) {
    console.error(error);
    res.status(500).send({ status: false, error: 'Internal Server Error' });
  }
});

async function getUserByUsername(username) {
  return new Promise((resolve, reject) => {
    db.query('SELECT * FROM members WHERE member_username = ?', [username], (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result.length > 0 ? result[0] : null);
      }
    });
  });
}
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

app.listen(3001, () => console.log('Avalable 3001'));

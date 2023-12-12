const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const cors = require('cors');

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
        res.send({ email: result[0].member_email , exist: false });
      } else {
        res.send({ username: username , exist: true });
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
      res.status(500).send({ exist: false, error: 'Internal Server Error' });
    } else {
      if (result.length > 0) {
        res.send({ username: result[0].member_username , exist: false });
      } else {
        res.send({ email: email ,exist: true });
      }
    }
  });
});

app.post('/register', (req, res) => {
  const { username, email, password, firstName, lastName, tel } = req.body;

  if (!username || !email || !password || !firstName || !lastName || !tel) {
    return res.status(400).send({ exist: false, error: 'Missing required fields' });
  }
  db.query('SELECT MAX(member_id) as maxId FROM members', (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).send({ exist: false, error: 'Internal Server Error' });
    }

    let nextId = 'MEM001'; 
    if (result[0].maxId) {
      const currentId = result[0].maxId;
      const numericPart = parseInt(currentId.substring(3), 10) + 1;
      nextId = 'MEM' + numericPart.toString().padStart(3, '0');
    }
    if (result.length > 0) {
      return res.status(409).send({ exist: false, error: 'Username or email already exists' });
    }

    db.query(
      'INSERT INTO members (member_id, member_username, member_email, member_password, member_name, member_phone, member_follows) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [nextId, username, email, password, firstName + ' ' + lastName, tel, null],
      (err, result) => {
        if (err) {
          console.log(err);
          return res.status(500).send({ exist: false, error: 'Internal Server Error' });
        }
        res.status(201).send({ exist: true });
      }
    );
  });
});


app.listen(3001, () => console.log('Avalable 3001'));

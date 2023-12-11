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
      res.send({ exist: result.length > 0 });
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
      res.send({ exist: result.length > 0 });
    }
  });
});

app.listen(3001, () => console.log('Avalable 3001'));

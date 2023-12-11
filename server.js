const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const cors = require('cors');

const app = express();
const port = 3000;

app.use(cors())
app.use(express.json());

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'kaset_data',
});
db.connect((err) => {
    if (err) {
      console.error('Error connecting to MySQL:', err);
    } else {
      console.log('Connected to MySQL database');
    }
  }); 

app.post('/checkinguser',(req,res) =>{
  console.log("Connect")
  console.log('Body :',req.body.username);
  res.send({exist:true})
  // db.query("SELECT * FROM members",(err,result)=>{
  //   if (err) {
  //     console.log(err);
  //   } else {
  //     res.send(result);
  //   }
  // });
});
app.post('/checkingemail',(req,res) =>{
  console.log('Body :',req.body.email);
});
app.listen(3001, () => console.log('Server is running on port 3001'));
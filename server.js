const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
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
const { log } = require('console');
const secretKey = 'pifOvrart4';
const excel = require('exceljs');
const moment = require('moment');
const momentz = require('moment-timezone');
require('dotenv').config();

app.use(cors({
  origin: '*',
}));
app.use(express.json());

var db_config = {
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
};
pool = mysql.createPool(db_config);

async function usePooledConnectionAsync(actionAsync) {
  const connection = await new Promise((resolve, reject) => {
    pool.getConnection((ex, connection) => {
      if (ex) {
        reject(ex);
      } else {
        resolve(connection);
      }
    });
  });
  try {
    return await actionAsync(connection);
  } finally {
    connection.release();
  }
}


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
    console.error('Error decoding token:1', error.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

const checkTambon = (req, res, next) => {
  const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : null;;
  if (!token) {
    return res.status(400).json({ error: 'Token not provided' });
  }
  try {
    const decoded = jwt.verify(token, secretKey);
    if (decoded.role !== 'tambons') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();

  } catch (error) {
    console.error('Error decoding token:2', error.message);
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
    console.error('Error decoding token:3', error.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}






app.post('/checkinguser', async (req, res) => {
  const username = req.body.username;
  await usePooledConnectionAsync(async db => {
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
  })


});

app.post('/checkingemail', (req, res) => {
  const email = req.body.email;
  usePooledConnectionAsync(async db => {
    db.query(
      `
      SELECT 'admins' AS role, email FROM admins WHERE email = ?
      UNION
      SELECT 'farmers' AS role, email FROM farmers WHERE email = ?
      UNION
      SELECT 'members' AS role, email FROM members WHERE email = ?
      UNION
      SELECT 'providers' AS role, email FROM providers WHERE email = ?
      UNION
      SELECT 'tambon' AS role, email FROM tambons WHERE email = ?
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
  })
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
    console.log(nextId);

    await insertMember(nextId, username, email, hashedPassword, firstName, lastName, tel);

    res.status(201).send({ exist: true });
  } catch (error) {
    console.error(error);
    res.status(500).send({ exist: false, error: 'Internal Server Error' });
  }
});

async function checkIfExists(role, column, value) {
  return await usePooledConnectionAsync(async db => {
    new Promise(async (resolve, reject) => {
      db.query(`SELECT * FROM ${role} WHERE ${column} = ?`, [value], (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result.length > 0);
        }
      });
    });
  })

}

async function checkIfExistsInAllTables(column, value) {
  const tables = ['admins', 'farmers', 'members', 'providers', 'tambons'];
  const promises = tables.map(table => checkIfExists(table, column, value));
  const results = await Promise.all(promises);
  return results.some(result => result);
}
app.post('/addfarmer', checkTambon, async (req, res) => {
  const { username, email, password, firstName, lastName, tel, lat, lng } = req.body;
  if (!username || !email || !password || !firstName || !lastName || !tel) {
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
    const nextUserId = await getNextUserId('farmers');
    await insertUser(nextUserId, username, email, hashedPassword, firstName, lastName, tel, 'farmers');
    const query = `INSERT INTO farmers (id, username, email, password, firstname, lastname, phone, lat, lng, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    await usePooledConnectionAsync(async db => {
      await new Promise((resolve, reject) => {
        db.query(query, [nextUserId, username, email, hashedPassword, firstName, lastName, tel, lat, lng, 'farmers'], (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      })
    });
    res.status(201).json({ success: true, message: 'Farmer added successfully' });
  } catch (error) {
    console.error('Error adding farmer:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }

})

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


app.get('/role', async (req, res) => {
  await usePooledConnectionAsync(async db => {
    db.query("SELECT 'admins' AS role_id, 'ผู้ดูแลระบบ' AS role_name FROM admins UNION SELECT 'members' AS role_id, 'สมาชิก' AS role_name FROM members UNION SELECT 'farmers' AS role_id, 'เกษตรกร' AS role_name FROM providers UNION SELECT 'providers' AS role_id, 'ผู้ว่าราชการจังหวัด' AS role_name FROM providers UNION SELECT 'tambons' AS role_id, 'เกษตรตำบล' AS role_name FROM tambons;", (err, result) => {
      if (err) {
        console.log(err);
        res.status(500).send({ exist: false, error: 'Internal Server Error' });
      } else {
        res.json(result);
      }
    });
  })
});

app.get('/users', async (req, res) => {
  const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : null;


  try {
    const decoded = jwt.verify(token, secretKey);
    const role = decoded.role;

    if (role !== 'admins' && role !== 'tambons') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    await usePooledConnectionAsync(async db => {
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
    })
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
    await usePooledConnectionAsync(async db => {
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
    })
    res.status(200).json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }

});


async function getNextId() {
  return await usePooledConnectionAsync(async db => {
    new Promise(async (resolve, reject) => {
      db.query('SELECT MAX(id) as maxId FROM members', (err, result) => {
        if (err) {
          reject(err);
        } else {
          let nextId = 'MEM000001';
          if (result[0].maxId) {
            const currentId = result[0].maxId;
            const numericPart = parseInt(currentId.substring(3), 10) + 1;

            nextId = 'MEM' + numericPart.toString().padStart(6, '0');
          }
          resolve(nextId);
        }
      });
    });
  })

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

  return await usePooledConnectionAsync(async db => {
    new Promise(async (resolve, reject) => {
      db.query(`SELECT MAX(id) as maxId FROM ${role}`, (err, result) => {
        if (err) {
          reject(err);
        } else {
          let nextUserId = `${rolePrefix}000001`;
          if (result[0].maxId) {
            const currentId = result[0].maxId;
            const numericPart = parseInt(currentId.substring(rolePrefix.length), 10) + 1;
            console.log(numericPart);
            nextUserId = `${rolePrefix}${numericPart.toString().padStart(6, '0')}`;
          }
          resolve(nextUserId);
        }
      });
    });
  })

}

async function insertMember(memberId, username, email, password, firstName, lastName, tel) {

  return await usePooledConnectionAsync(async db => {
    new Promise(async (resolve, reject) => {
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
  })

}

async function insertUser(memberId, username, email, password, firstName, lastName, tel, role) {
  return await usePooledConnectionAsync(async db => {
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
  })

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
  console.log(123)
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
    console.error('Error decoding token:4', error.message);
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
  return usePooledConnectionAsync(async db => {
    return await new Promise((resolve, reject) => {
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
  })
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
  usePooledConnectionAsync(async db => {
    db.query("SELECT * FROM categories where available = 1", (err, result) => {
      if (err) {
        console.log(err);
        res.status(500).send({ exist: false, error: 'Internal Server Error' });
      } else {
        res.json(result);
      }
    });
  })

});

app.delete('/categories', checkAdmin, async (req, res) => {
  const { category_id } = req.body;
  if (!category_id) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }
  await usePooledConnectionAsync(async db => {
    //soft delete
    const query = 'UPDATE categories SET available = 0 WHERE category_id = ?';

    db.query(query, [category_id], (err, result) => {
      if (err) {
        console.error('Error deleting category:', err);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
      } else {
        return res.status(200).json({ success: true, message: 'Category deleted successfully' });
      }
    })
  })

});

app.post('/categories', checkAdmin, async (req, res) => {
  let { category_id = null, category_name, bgcolor } = req.body;
  if (!category_name || !bgcolor) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }
  //check if category_name is exist
  await usePooledConnectionAsync(async db => {
    let queryCategory_name = 'SELECT * FROM categories WHERE category_name = ? and available = 1';
    let category_nameResult = await new Promise((resolve, reject) => {
      db.query(queryCategory_name, [category_name], (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    })


    if (category_nameResult.length > 0 && !category_id) {
      return res.status(409).json({ success: false, message: 'หมวดหมู่ที่เพิ่มเข้ามามีอยู่ในระบบอยู่แล้ว' });
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
              console.log(result[0]);
              const nextNumericPart = currentIdNumericPart + 1;
              const paddedNextNumericPart = String(nextNumericPart).padStart(4, '0');
              nextId = 'CAT' + paddedNextNumericPart;
            }
            resolve(nextId);
          }
        });
      })

      console.log(category_id);
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

    })

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
});

app.get('/producttypes', async (req, res) => {
  await usePooledConnectionAsync(async db => {
    db.query("SELECT * FROM product_types", (err, result) => {
      if (err) {
        console.log(err);
        res.status(500).send({ exist: false, error: 'Internal Server Error' });
      } else {
        res.json(result);
      }
    });
  })
});
app.get('/standardproducts', async (req, res) => {
  await usePooledConnectionAsync(async db => {
    db.query("SELECT * FROM standard_products where available = 1", (err, result) => {
      if (err) {
        console.log(err);
        res.status(500).send({ exist: false, error: 'Internal Server Error' });
      } else {
        res.json(result);
      }
    });
  })
});

async function checkIfEmailAndNameMatch(email) {
  return await usePooledConnectionAsync(async db => {
    return new Promise(async (resolve, reject) => {
      try {
        const query = `
    SELECT email FROM members
    UNION
    SELECT email FROM admins
    UNION
    SELECT email FROM farmers
    UNION
    SELECT email FROM providers
    UNION
    SELECT email FROM tambons;
    `;
        db.query(query, [email], (err, result) => {
          if (err) {
            console.error('Error checking email and name in database:', err);
            reject(err);
          } else {
            resolve(result.length > 0);
          }
        });
      } catch (error) {
        reject(error);
      }
    });

  });

}

app.post('/forgot', async (req, res) => {
  const { email } = req.body;

  try {
    const isMatch = await checkIfEmailAndNameMatch(email);

    if (isMatch) {
      const newPassword = generateRandomPassword();

      sendNewPasswordByEmail(email, newPassword);


      updatePasswordInDatabase(email, newPassword);

      res.json({ email: true });
    } else {
      res.json({ email: false });
    }
  } catch (error) {
    console.error('Error in forgot endpoint:', error);
    res.status(500).json({ email: 'false' });
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
    await usePooledConnectionAsync(async db => {
      const hashedPassword = await hashPassword(newPassword);

      db.query('UPDATE members SET password = ? WHERE email = ?', [hashedPassword, email], (err, result) => {
        if (err) {
          console.error('Error updating password in database:', err);
        } else {
          console.log('Password updated in database');
        }
      });
    })
  } catch (error) {
    console.error('Error hashing password:', error);
  }
}

app.get('/standardproducts', async (req, res) => {
  await usePooledConnectionAsync(async db => {
    db.query("SELECT * FROM standard_products", (err, result) => {
      if (err) {
        console.log(err);
        res.status(500).send({ exist: false, error: 'Internal Server Error' });
      } else {
        res.json(result);
      }
    });
  })
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
  return await usePooledConnectionAsync(async db => {
    return new Promise((resolve, reject) => {
      db.query('SELECT MAX(product_id) as maxId FROM products', (err, result) => {
        if (err) {
          reject(err);
        } else {
          let nextId = 'PROD000001';
          if (result[0].maxId) {
            const currentIdNumericPart = parseInt(result[0].maxId.substring(4), 10);
            const nextNumericPart = currentIdNumericPart + 1;
            const paddedNextNumericPart = String(nextNumericPart).padStart(6, '0');
            nextId = 'PROD' + paddedNextNumericPart;
          }
          resolve(nextId);
        }
      });
    })
  });
}
const upload = multer({ storage: storage });

app.post('/addproduct', checkFarmer, async (req, res) => {
  const {
    product_id,
    product_name,
    category_id,
    product_description,
    selectedType,
    price,
    unit,
    stock,
    selectedStatus,
    startDate,
    endDate,
    product_image,
    product_video,
    additional_images,
    certificate,
    shippingcost,
  } = req.body;

  const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : null;
  const decoded = jwt.verify(token, secretKey);
  try {
    let { ID: farmerId } = decoded
    await usePooledConnectionAsync(async db => {

      if (product_id) {
        const query = `UPDATE products SET product_name = ?, product_description = ?, category_id = ?, stock = ?, price = ?, unit = ?, product_image = ?, product_video = ?, additional_image = ?, selectedType = ?, certificate = ?, shippingcost = ?, last_modified = NOW() WHERE product_id = ? and farmer_id = ?`;
        db.query(query, [product_name, product_description, category_id, stock, price, unit, product_image, product_video, additional_images, selectedType, certificate, shippingcost, product_id, farmerId]);
        return res.status(200).send({ success: true, message: 'Product updated successfully' });
      }
      const nextProductId = await getNextProductId();

      const query = `
        INSERT INTO products (product_id, farmer_id, product_name, product_description, category_id, stock, price, unit, product_image, product_video, additional_image,selectedType,certificate, shippingcost, last_modified)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `;
      db.query(query, [nextProductId, farmerId, product_name, product_description, category_id, stock, price, unit, product_image, product_video, additional_images, selectedType, certificate, shippingcost]);
      return res.status(200).send({ success: true, message: 'Product added successfully' });
    })
  } catch (error) {
    console.error('Error adding product:', error);
    return res.status(500).send({ success: false, message: 'Internal Server Error' });
  }
});

app.get('/getimage/:image', (req, res) => {
  const image = req.params.image;
  res.sendFile(path.join(__dirname, 'uploads', image));
});

app.get('/getproduct/:shopname/:product_id', async (req, res) => {
  const { product_id, shopname } = req.params;
  await usePooledConnectionAsync(async db => {
    db.query('SELECT p.* FROM products p LEFT JOIN farmers f ON p.farmer_id = f.id WHERE p.product_id = ? and f.farmerstorename = ? and p.available = 1;', [product_id, shopname], (err, result) => {
      if (err) {
        console.log(err);
        res.status(500).send({ exist: false, error: 'Internal Server Error' });
      } else {
        console.log(result[0]);
        res.json(result[0]);
      }
    });
  })
});

app.get('/getproducts', async (req, res) => {
  let { search, category, page, sort, order, perPage, groupby } = req.query;
  if (page < 1) {
    page = 1;
  }
  page -= 1;
  if (!perPage) {
    perPage = 40;
  }
  let queryMaxPage = `SELECT COUNT(*) as maxPage FROM products where available = 1 and ${search !== "" ? `${"product_name LIKE '%" + search + "%' AND"}` : ''} category_id = '${category}'`;
  let query = `SELECT p.*, f.lat, f.lng, f.farmerstorename FROM products p INNER JOIN farmers f ON p.farmer_id = f.id where p.available = 1 and ${search !== "" ? `${"product_name LIKE '%" + search + "%' AND"}` : ''} category_id = '${category}' ${groupby ? "group by p.farmer_id" : ''} ORDER BY ${sort} ${order} LIMIT ${perPage} OFFSET ${page * perPage}`;
  if (category == '') {
    queryMaxPage = `SELECT COUNT(*) as maxPage FROM products where available = 1 ${search !== "" ? `${`${"and product_name LIKE '%" + search + "%'"}`}` : ''}`;
    query = `SELECT p.*, f.lat, f.lng, f.farmerstorename FROM products p INNER JOIN farmers f ON p.farmer_id = f.id where p.available = 1 ${search !== "" ? `${"and product_name LIKE '%" + search + "%'"}` : ''} ${groupby ? "group by p.farmer_id" : ''} ORDER BY ${sort} ${order} LIMIT ${perPage} OFFSET ${page * perPage} `;
  }
  console.log(query);
  await usePooledConnectionAsync(async db => {
    let AllPage = await new Promise((resolve, reject) => {
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
        res.json({ products: result, maxPage: AllPage % perPage === 0 ? AllPage / perPage : Math.floor(AllPage / perPage) + 1 });
      }
    });
  })
});

app.get('/getpayment/:id', async (req, res) => {
  await usePooledConnectionAsync(async db => {
    const id = req.params.id;
    db.query('SELECT payment FROM farmers WHERE id = (select farmer_id from products where product_id = ?)', [id], (err, result) => {
      if (err) {
        console.log(err);
        res.status(500).send({ exist: false, error: 'Internal Server Error' });
      } else {
        res.json(result[0]);
      }
    });
  })
});

app.delete('/deleteproduct/:id', checkFarmer, async (req, res) => {
  const { id } = req.params;
  const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : null;;
  const decoded = jwt.verify(token, secretKey);
  console.log(decoded.ID);
  await usePooledConnectionAsync(async db => {
    //soft delete
    db.query(`UPDATE products SET available = 0 WHERE product_id = "${id}" and farmer_id = "${decoded.ID}"`, (err, result) => {
      if (err) {
        console.log(err);
        res.status(500).send({ exist: false, error: 'Internal Server Error' });
      } else {
        res.json({ success: true });
      }
    });
  })
});

app.get('/updateview/:id', async (req, res) => {
  const { id } = req.params;
  // update view_count + 1
  console.log(id);
  await usePooledConnectionAsync(async db => {
    db.query('UPDATE products SET view_count = view_count + 1 WHERE product_id = ?', [id], (err, result) => {
      if (err) {
        console.log(err);
        res.status(500).send({ exist: false, error: 'Internal Server Error' });
      } else {
        res.json({ success: true });
      }
    });
  })
})

app.get('/myproducts/:username', async (req, res) => {
  await usePooledConnectionAsync(async db => {
    const { username } = req.params;
    db.query('SELECT p.product_id, p.product_image, p.product_description, p.product_name, p.selectedType, p.last_modified, p.price, p.view_count, p.category_id,c.category_name, f.farmerstorename FROM products p left join farmers f on p.farmer_id = f.id LEFT JOIN categories c on p.category_id = c.category_id WHERE p.farmer_id = (select id from farmers where username = ?) and p.available = 1;', [username], (err, result) => {
      if (err) {
        console.log(err);
        res.status(500).send({ exist: false, error: 'Internal Server Error' });
      } else {
        res.json(result);
      }
    });
  })
});

app.get("/getinfo", async (req, res) => {
  const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : null;;
  if (!token) {
    return res.status(400).json({ error: 'Token not provided' });
  }
  try {
    const decoded = jwt.verify(token, secretKey);
    const { username, role } = decoded
    var query
    if (role === "farmers") {
      query = `SELECT farmerstorename, username, email, firstname, lastname, phone, address, province, amphure, tambon, payment,facebooklink, lineid , lat, lng, zipcode from ${role} where username = "${username}"`
    }
    else if (role === "members") {
      query = `SELECT username, email, firstname, lastname, phone, address from ${role} where username = "${username}"`
    }
    else {
      query = `SELECT username, email, firstname, lastname, phone from ${role} where username = "${username}"`

    }
    console.log(query);
    await usePooledConnectionAsync(async db => {
      db.query(query, (err, result) => {
        if (err) {
          console.log(err);
          res.status(500).send({ exist: false, error: 'Internal Server Error' });
        } else {
          console.log(result);
          res.json(result[0]);
        }
      })
    })

      ;

    return res.status(200);
  } catch (error) {
    console.error('Error decoding token:5', error.message);
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
    payment = null,
    province = null,
    amphure = null,
    tambon = null,
  } = req.body;
  try {
    console.log(req.body);
    let decoded = jwt.verify(token, secretKey);
    const { username, role } = decoded
    if (role === "farmers") {
      query = `UPDATE ${role} SET email = "${email}", firstname = "${firstname}", lastname = "${lastname}", phone = "${phone}", address = "${address}", facebooklink = "${facebooklink}", lineid = "${lineid}", lat = ${lat ? `${lat}` : null}, lng = ${lng ? `${lng}` : null}, zipcode = "${zipcode}", payment = "${payment}", farmerstorename = "${farmerstorename}", province = "${province}", amphure="${amphure}", tambon="${tambon}" WHERE username = "${username}"`
    }
    else if (role === "members") {
      query = `UPDATE ${role} SET email = "${email}", firstname = "${firstname}", lastname = "${lastname}", phone = "${phone}" , address = "${address}" WHERE username = "${username}"`
    }
    else {
      query = `UPDATE ${role} SET email = "${email}", firstname = "${firstname}", lastname = "${lastname}", phone = "${phone}" WHERE username = "${username}"`

    }
    console.log(query);
    await usePooledConnectionAsync(async db => {
      db.query(query, (err, result) => {
        if (err) {
          console.log(err);
          res.status(500).send({ exist: false, error: 'Internal Server Error' });
        } else {
          console.log(result);
          res.json(result[0]);
        }
      })
    });

    return res.status(200);
  }
  catch (error) {
    console.error('Error decoding token:6', error.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
})

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
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }
  try {

    var query
    if (role === "farmers") {
      query = `UPDATE ${role} SET email = "${email}", firstname = "${firstname}", lastname = "${lastname}", phone = "${phone}", address = "${address}", facebooklink = "${facebooklink}" , lineid = "${lineid}", payment = "${payment}", lat = ${lat ? `${lat}` : null}, lng = ${lng ? `${lng}` : null}, zipcode = "${zipcode}", farmerstorename = "${farmerstorename}", province = "${province}", amphure="${amphure}", tambon="${tambon}" WHERE username = "${username}"`
    }
    else if (role === "members") {
      query = `UPDATE ${role} SET email = "${email}", firstname = "${firstname}", lastname = "${lastname}", phone = "${phone}", address = "${address}" WHERE username = "${username}"`
    }
    else {
      query = `UPDATE ${role} SET email = "${email}", firstname = "${firstname}", lastname = "${lastname}", phone = "${phone}" WHERE username = "${username}"`

    }
    console.log(query);
    await usePooledConnectionAsync(async db => {
      db.query(query, (err, result) => {
        if (err) {
          console.log(err);
          res.status(500).send({ exist: false, error: 'Internal Server Error' });
        } else {
          console.log(result);
          res.json(result[0]);
        }
      });
    })
    return res.status(200);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

app.get("/getuseradmin/:role/:username", checkAdmin, async (req, res) => {

  const { role, username } = req.params;
  var query
  if (role !== "farmers") {
    query = `SELECT username, email, firstname, lastname, phone from ${role} where username = "${username}"`
  }
  else if (role === "members") {
    query = `SELECT username, email, firstname, lastname, phone, address from ${role} where username = "${username}"`
  }
  else {
    query = `SELECT farmerstorename, username, email, firstname, lastname, phone, address, province, amphure, tambon, facebooklink, lineid , lat, lng, zipcode from ${role} where username = "${username}"`

  }
  await usePooledConnectionAsync(async db => {
    db.query(query, (err, result) => {
      if (err) {
        console.log(err);
        res.status(500).send({ exist: false, error: 'Internal Server Error' });
      } else {
        console.log(result);
        res.json(result[0]);
      }
    });
  })

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


app.post('/checkout', upload.fields([{ name: 'productSlip', maxCount: 1 }]), async (req, res) => {
  let { cartList } = req.body;
  var SUMITNOW = 0

  try {
    await usePooledConnectionAsync(async db => {
      cartList = JSON.parse(cartList)
      if (!cartList || !Array.isArray(cartList) || cartList.length === 0) {
        return res.status(400).json({ success: false, message: 'Empty or invalid cart data' });
      }
      const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : null;;
      const decoded = jwt.verify(token, secretKey);
      await new Promise((resolve, reject) => {
        db.beginTransaction(err => {
          if (err) reject(err);
          else resolve();
        });
      });
      let idoffarmer
      const getAddress = 'SELECT address FROM members WHERE id = ?';
      const memberaddress = await new Promise((resolve, reject) => {
        db.query(getAddress, [decoded.ID], (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });
      const productSlipFile = req.files['productSlip'] ? req.files['productSlip'][0] : null;
      const productSlipPath = productSlipFile ? `./uploads/${productSlipFile.filename}` : null;
      let address
      if (req.body.address) {
        address = req.body.address;
      } else {
        address = memberaddress[0].address;
      }
      console.log("-+-+-+-+--++--+-+-+-+-+-+-+-+-+-+-+");
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
      const insertOrderVB = 'INSERT INTO order_sumary (id,status,total_amount,member_id,transaction_confirm,address,date_buys) VALUES (?,?,?,?,?,?,NOW())';
      await new Promise((resolve, reject) => {
        db.query(insertOrderVB, [ORDNXT, 'pending', SUMITNOW, decoded.ID, productSlipPath, address], (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
          console.log("ORDNXT", ORDNXT);
        });
      });
      for (const item of cartList) {
        const { product_id, amount } = item;
        console.log(decoded);
        const getProductQuery = 'SELECT stock, farmer_id, selectedType FROM products WHERE product_id = ?';
        console.log(productSlipPath);
        const [product] = await new Promise((resolve, reject) => {
          db.query(getProductQuery, [product_id], (err, result) => {
            if (err) {
              reject(err);
            } else {
              resolve(result);
            }
          });
        });
        console.log("idoffarmer");
        console.log(idoffarmer);
        console.log(product.farmer_id);
        console.log(product.selectedType);
        if (!idoffarmer) {
          idoffarmer = product.farmer_id
        }
        else if (idoffarmer != product.farmer_id) {
          return res.status(400).json({ success: false, message: 'Cart items must be from the same farmer' });
        }
        if (product.selectedType != "สินค้าจัดส่งพัสดุ") {
          return res.status(400).json({ success: false, message: 'Order Has Not avalable' })
        }
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
        console.log("total : ", totalProductPrice);
        console.log(product.farmer_id);
        console.log(cartList[0].farmer_id);
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
        const insertOrderItemQuery = 'INSERT INTO order_items (item_id,product_id,order_id,price, quantity) VALUES (?,?,?,?,?)';
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
      const updateSUM = 'UPDATE order_sumary SET total_amount = ? WHERE id = ?';
      await new Promise((resolve, reject) => {
        db.query(updateSUM, [SUMITNOW, ORDNXT], (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });
      if (SUMITNOW == 0) {
        return res.status(400).send({ error: `ERROR of total amount = 0` });
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
    })
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
    await usePooledConnectionAsync(async db => {
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

      if (status === "complete") {
        // Update comment to null for complete status
        await addComment(order_id, null);
      } else if (status === "reject") {
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
    })
  } catch (error) {
    console.error('Error updating order status:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});


app.get('/orderlist', async (req, res) => {
  try {
    await usePooledConnectionAsync(async db => {
      const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : null;
      const decoded = jwt.verify(token, secretKey);
      const orderQuery = 'SELECT * FROM order_sumary WHERE member_id = ?';
      const orders = await new Promise((resolve, reject) => {
        db.query(orderQuery, [decoded.ID], async (err, result) => {
          if (err) {
            reject(err);
          } else {
            for (const order of result) {
              if (!order.transaction_confirm) {
                order.transaction_confirm = null;
              }
              const products = await new Promise((resolve, reject) => {
                const orderItemsQuery = 'SELECT oi.product_id, p.product_name, p.product_image, oi.quantity, oi.price FROM order_items oi INNER JOIN products p ON oi.product_id = p.product_id WHERE oi.order_id = ?';
                db.query(orderItemsQuery, [order.id], async (err, result) => {
                  if (err) {
                    reject(err);
                  } else {
                    Promise.all(result.map(async (product) => {
                      return await new Promise((resolve, reject) => {
                        const getCommentQuery = 'SELECT rating, date_comment, comment FROM product_reviews WHERE product_id = ? and order_id = ? and available = 1';
                        db.query(getCommentQuery, [product.product_id, order.id], (err, result) => {
                          if (err) {
                            reject(err);
                          } else {
                            resolve({
                              product_id: product.product_id,
                              product_name: product.product_name,
                              product_image: product.product_image,
                              quantity: product.quantity,
                              price: product.price,
                              comment: result[0] ? result[0] : null
                            });
                          }
                        });
                      })


                    })).then((formattedProducts) => {
                      resolve(formattedProducts);

                    })

                  }
                });
              });
              order.products = products;
              delete order.member_id;
            }
            resolve(result);
          }
        });
      });
      res.status(200).json({ success: true, orders: orders });
    })
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

    const updatedOrders = await usePooledConnectionAsync(async db => {
      return await new Promise(async (resolve, reject) => {
        db.query(orderQuery, [productSlipPath, 'pending', order_id, decoded.ID], (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      })
    });

    // Return success response with the updated orders
    res.status(200).json({ success: true, message: 'Order transaction confirmation updated successfully', orders: updatedOrders });
  } catch (error) {
    // Handle errors
    console.error('Error updating order transaction confirmation:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

app.get('/imagestore', async (req, res) => {
  const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : null;
  if (!token) {
    return res.status(400).json({ error: 'Token not provided' });
  }
  try {
    const decoded = jwt.verify(token, secretKey);

    const imageQuery = 'SELECT imagepath FROM image WHERE farmer_id = ?';
    const images = await usePooledConnectionAsync(async db => {
      return await new Promise(async (resolve, reject) => {
        db.query(imageQuery, [decoded.ID], (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        })
      });
    });
    let allimage = {
      images: [],
      videos: []
    }
    images.forEach(image => {
      if (image.imagepath.match(
        /\.(mp4|webm|ogg|ogv|avi|mov|wmv|flv|3gp)$/i
      )) {
        allimage.videos.push(image.imagepath)
      }
      else {
        allimage.images.push(image.imagepath)
      }
    });
    res.status(200).json({ ...allimage });
  } catch (error) {
    console.error('Error fetching images:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
})
app.post('/imageupload', upload.fields([{ name: 'image', maxCount: 10 }]), async (req, res) => {
  try {
    const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : null;
    const decoded = jwt.verify(token, secretKey);
    if (!req.files['image']) {
      return res.status(400).json({ success: false, message: 'No images uploaded' });
    }
    const imagePaths = req.files['image'] ? req.files['image'].map(file => `./uploads/${file.filename}`) : null;
    imagePaths.map(async (imagePath, index) => {
      async function getNextImageId(index) {
        return await usePooledConnectionAsync(async db => {
          return await new Promise(async (resolve, reject) => {
            db.query('SELECT MAX(id) as maxId FROM image', (err, result) => {
              if (err) {
                reject(err);
              } else {
                console.log(result);
                let nextimageId = 'IMG000000001';
                if (result[0].maxId) {
                  const currentId = result[0].maxId;
                  const numericPart = parseInt(currentId.substring(3), 10) + 1 + index;
                  console.log(numericPart, numericPart.toString().padStart(9, '0'));
                  nextimageId = 'IMG' + numericPart.toString().padStart(9, '0');
                }
                resolve(nextimageId);
              }
            });
          })
        });
      }
      const nextimageId = await getNextImageId(index);
      const insertImageQuery = 'INSERT INTO image (id, imagepath, farmer_id) VALUES (?,?, ?)';
      await usePooledConnectionAsync(async db => {

        await new Promise(async (resolve, reject) => {
          db.query(insertImageQuery, [nextimageId, imagePath, decoded.ID], (err, result) => {
            if (err) {
              reject(err);
            } else {
              resolve(result);
            }
          });
        });
      })
    });

    res.status(200).json({ success: true, message: 'Images uploaded successfully' });
  } catch (error) {
    // Handle errors
    console.error('Error uploading images:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

app.get('/farmerorder', async (req, res) => {
  try {
    const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : null;
    const decoded = jwt.verify(token, secretKey);
    const orderItemsQuery = `
    SELECT oi.order_id, oi.product_id, oi.quantity, oi.price, 
    os.total_amount, os.transaction_confirm, os.date_buys, os.date_complete, os.status, os.tracking_number, os.address,
    m.id, m.firstname, m.lastname, m.phone,
    p.product_name, p.product_image
    FROM order_items oi
    INNER JOIN order_sumary os ON oi.order_id = os.id
    INNER JOIN members m ON os.member_id = m.id
    INNER JOIN products p ON oi.product_id = p.product_id
    INNER JOIN farmers f ON p.farmer_id = f.id
    WHERE f.id = ?
    `;
    const orderItemsResult = await usePooledConnectionAsync(async db => {
      return await new Promise(async (resolve, reject) => {
        db.query(orderItemsQuery, [decoded.ID], (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      })
    });

    const farmerOrdersMap = new Map();
    orderItemsResult.forEach(orderItem => {
      const order_id = orderItem.order_id;
      if (!farmerOrdersMap.has(order_id)) {
        farmerOrdersMap.set(order_id, {
          order_id: order_id,
          products: [],
          tracking_number: orderItem.tracking_number,
          total_amount: orderItem.total_amount,
          transaction_confirm: orderItem.transaction_confirm,
          customer_info: {
            member_id: orderItem.id,
            firstname: orderItem.firstname,
            lastname: orderItem.lastname,
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
        product_name: orderItem.product_name,
        product_image: orderItem.product_image,
        quantity: orderItem.quantity,
        price: orderItem.price,
      });
    });

    const farmerOrders = Array.from(farmerOrdersMap.values());
    res.json(farmerOrders);
  } catch (error) {
    console.error('Error fetching farmer orders:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

app.post('/confirmorder', async (req, res) => {
  try {
    const { order_id, status, comment, tracking_number } = req.body;
    if (!order_id || !status) {
      return res.status(400).json({ success: false, message: 'Incomplete request data' });
    }

    if (status !== "complete" && status !== "reject" && status !== "waiting") {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    console.log(req.body);

    const updateOrderStatusQuery = `UPDATE order_sumary SET status = ? ${comment ? `,comment = "${comment}"` : ''} ${status == "complete" ? `${",tracking_number = " + tracking_number + ",date_complete = NOW()"}` : ''} WHERE id = ?`;
    console.log(updateOrderStatusQuery);
    const updatedOrders =
      await usePooledConnectionAsync(async db => {
        return await new Promise(async (resolve, reject) => {

          db.query(updateOrderStatusQuery, [status, order_id], (err, result) => {
            if (err) {
              reject(err);
            } else {
              resolve(result);
            }
          });
        })
      });

    res.status(200).json({ success: true, message: 'Order status updated successfully', orders: updatedOrders });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});


app.post('/comment', async (req, res) => {
  const { rating, comment, product_id, order_id } = req.body;
  try {

    const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : null;
    const decoded = jwt.verify(token, secretKey);

    // Function to get the next review ID
    async function getNextReviewId() {
      return await usePooledConnectionAsync(async db => {
        return new Promise(async (resolve, reject) => {
          db.query('SELECT MAX(review_id) as maxId  FROM product_reviews', (err, result) => {
            if (err) {
              reject(err);
            } else {
              let nextRev = 'REV000001';
              if (result[0].maxId) {
                const currentId = result[0].maxId;
                const numericPart = parseInt(currentId.substring(3), 10) + 1;
                nextRev = 'REV' + numericPart.toString().padStart(7, '0');
              }
              resolve(nextRev);
            }
          });
        })
      });
    }
    const checkOrderStatusQuery = `
SELECT os.id AS order_id 
FROM order_sumary os 
INNER JOIN order_items oi ON os.id = oi.order_id 
WHERE os.member_id = ? 
AND oi.product_id = ? 
AND os.status = 'complete'
`;
    const orderResult =
      await usePooledConnectionAsync(async db => {
        return await new Promise(async (resolve, reject) => {
          db.query(checkOrderStatusQuery, [decoded.ID, product_id], (err, result) => {
            if (err) {
              reject(err);
            } else {
              resolve(result);
            }
          });
        })
      });

    if (!orderResult || orderResult.length === 0) {
      return res.status(400).json({ success: false, message: 'Member has not purchased this product or order is not complete' });
    }

    // Check if all necessary data is provided
    if (!decoded.ID || !product_id || !rating) {
      return res.status(400).json({ success: false, message: 'Incomplete comment data' });
    }

    // Check if rating is valid
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
    }

    // Check if the member has purchased the product

    await usePooledConnectionAsync(async db => {

      const checkOrderQuery = 'SELECT os.id AS order_id FROM order_sumary os INNER JOIN order_items oi ON os.id = oi.order_id WHERE os.member_id = ? AND oi.product_id = ?';
      const [orderResult] = await new Promise(async (resolve, reject) => {
        db.query(checkOrderQuery, [decoded.ID, product_id], (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      })

      const checkDuplicateOrderQuery = 'SELECT * FROM product_reviews WHERE order_id = ? AND product_id = ?';
      const duplicateOrders = await new Promise(async (resolve, reject) => {
        db.query(checkDuplicateOrderQuery, [order_id, product_id], (err, result) => { // เพิ่มเงื่อนไขในการตรวจสอบซ้ำด้วย product_id
          if (err) {
            reject(err);
          } else {
            console.log(result);
            console.log(product_id);
            resolve(result);
          }
        });
      });

      console.log("birdddddddddddddd");
      console.log(duplicateOrders);

      if (duplicateOrders.length > 0) {
        return res.status(400).json({ success: false, message: 'Order ID already exists in product reviews' });
      }

      if (!orderResult || orderResult.length === 0) {
        return res.status(400).json({ success: false, message: 'Member has not purchased this product' });
      }

      const nextReviewId = await getNextReviewId();

      const insertCommentQuery = 'INSERT INTO product_reviews (review_id, member_id, rating, comment, product_id,order_id,date_comment) VALUES (?, ?, ?, ?, ?, ?,NOW())';
      console.log(orderResult.order_id);

      db.query(insertCommentQuery, [nextReviewId, decoded.ID, rating, comment, product_id, order_id], (err, result) => {
        if (err) {
          console.error('Error adding comment:', err);
        } else {
          return res.status(200).json({ success: true, message: 'Comment added successfully' });

        }

      });
    });

  } catch (error) {
    console.error('Error adding comment:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});
app.get('/getcomment/:id', async (req, res) => {
  const id = req.params.id;
  console.log(id);
  if (!id) {
    return res.status(400).json({ success: false, error: 'Invalid product ID' });
  }
  await usePooledConnectionAsync(async db => {
    db.query('SELECT pr.review_id, pr.member_id, m.username AS member_username, pr.product_id, pr.order_id, pr.rating, pr.comment, DATE_FORMAT(pr.date_comment, "%Y-%m-%d %H:%i:%s") AS date_comment FROM product_reviews pr LEFT JOIN members m ON pr.member_id = m.id WHERE pr.product_id = ? AND pr.available = 1', [id], (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ success: false, error: 'Internal Server Error' });
      }
      // ส่งข้อมูลความคิดเห็นกลับไปในรูปแบบ JSON
      res.json({ success: true, reviews: result });
    });
  })
});
app.post('/editcomment/:id', async (req, res) => {
  const commentId = req.params.id;
  const { rating, comment } = req.body;
  const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : null;
  const decoded = jwt.verify(token, secretKey);
  // ตรวจสอบค่า ID ที่รับเข้ามา
  if (!commentId) {
    return res.status(400).json({ success: false, error: 'Invalid comment ID' });
  }

  try {
    await usePooledConnectionAsync(async db => {
      // เชื่อมต่อกับฐานข้อมูลเพื่อดึงข้อมูลความคิดเห็น
      const getCommentQuery = 'SELECT * FROM product_reviews WHERE review_id = ?';
      const [existingComment] = await new Promise((resolve, reject) => {

        db.query(getCommentQuery, [commentId], (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });
      if (decoded.ID != existingComment.member_id) {
        return res.status(403).json({ success: false, error: 'Unauthorized access' });
      }
      if (rating < 1 || rating > 5) {
        return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
      }
      if (!existingComment) {
        return res.status(404).json({ success: false, error: 'Comment not found' });
      }
      const updateCommentQuery = 'UPDATE product_reviews SET rating = ?, comment = ? WHERE review_id = ?';
      const EDITC = await new Promise((resolve, reject) => {
        db.query(updateCommentQuery, [rating, comment, commentId], (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });
      console.log(EDITC);
      res.status(200).json({ success: true, message: 'Comment updated successfully' });
    })
  } catch (error) {
    console.error('Error editing comment:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

app.post('/deletecomment/:id', async (req, res) => {
  const commentId = req.params.id;
  const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : null;
  const decoded = jwt.verify(token, secretKey);

  // ตรวจสอบค่า ID ที่รับเข้ามา
  if (!commentId) {
    return res.status(400).json({ success: false, error: 'Invalid comment ID' });
  }
  try {
    // เชื่อมต่อกับฐานข้อมูลเพื่อดึงข้อมูลความคิดเห็น
    await usePooledConnectionAsync(async db => {
      const getCommentQuery = 'SELECT * FROM product_reviews WHERE review_id = ?';
      const [existingComment] = await new Promise((resolve, reject) => {
        db.query(getCommentQuery, [commentId], (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });
      // ตรวจสอบว่าผู้ใช้เป็นเจ้าของความคิดเห็นหรือไม่
      if (decoded.ID != existingComment.member_id) {
        return res.status(403).json({ success: false, error: 'Unauthorized access' });
      }
      // อัปเดตค่าความคิดเห็น (Soft Delete)
      const softDeleteCommentQuery = 'UPDATE product_reviews SET available = 0 WHERE review_id = ?';
      await new Promise((resolve, reject) => {
        db.query(softDeleteCommentQuery, [commentId], (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });

    })
    res.status(200).json({ success: true, message: 'Comment soft deleted successfully' });

  } catch (error) {
    console.error('Error soft deleting comment:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// app.get('/excel', async (req, res) => {
//   try {
//     await usePooledConnectionAsync(async db => {
//       const sqlQuery = `
//         SELECT 
//           f.id AS farmer_id, 
//           f.email, 
//           f.username, 
//           f.firstname, 
//           f.lastname, 
//           f.farmerstorename, 
//           f.phone,
//           p.product_id, 
//           p.product_name, 
//           p.stock, 
//           p.price
//         FROM 
//           farmers f
//         LEFT JOIN 
//           products p ON f.id = p.farmer_id
//       `;


//       const data = await new Promise((resolve, reject) => {
//         db.query(sqlQuery, (err, result) => {
//           if (err) {
//             reject(err);
//           } else {
//             resolve(result);
//           }
//         });
//       });
//       console.log(data);
//       const workbook = new excel.Workbook();

//       const farmerWorksheet = workbook.addWorksheet('Farmers');
//       const farmerHeaders = ['ID', 'Email', 'Username', 'Firstname', 'Lastname', 'Farmerstore', 'Phone','TOTAL Product'];
//       farmerWorksheet.addRow(farmerHeaders); // Add header row

//       const farmerProductSheets = {}; // Store farmer product worksheets

//       const addedFarmerIds = {}; // Store added farmer ids
//       const productCounts = {};
//       data.forEach(row => {
//         // Check if farmer ID is already added
//         if (!productCounts[row.farmer_id]) {
//           productCounts[row.farmer_id] = 1;
//         } else {
//           productCounts[row.farmer_id]++;
//         }
//         if (!addedFarmerIds[row.farmer_id]) {
//           const rowData = [row.farmer_id, row.email, row.username, row.firstname, row.lastname, row.farmerstorename,row.phone,productCounts];
//           farmerWorksheet.addRow(rowData); // Add farmer data row
//           addedFarmerIds[row.farmer_id] = true; // Mark farmer ID as added
//         }


//         // Create product sheet for each farmer if not already exists
//         if (!farmerProductSheets[row.farmer_id]) {
//           farmerProductSheets[row.farmer_id] = workbook.addWorksheet(`Products_${row.farmer_id}`);
//           const productHeaders = ['Product ID', 'Product Name', 'Stock', 'Price',];
//           farmerProductSheets[row.farmer_id].addRow(productHeaders); // Add header row
//           farmerProductSheets[row.farmer_id].getCell('E1').value = {
//             text: 'Back to Farmers',
//             hyperlink: `#Farmers!A1`,
//             tooltip: 'Go back to Farmers'
//           };
//         }
//         // Add product data to corresponding farmer's product sheet
//         const productData = [row.product_id, row.product_name, row.stock, row.price];
//         farmerProductSheets[row.farmer_id].addRow(productData); // Add product data row

//         // Add hyperlink in farmer worksheet to link to product sheet
//         farmerWorksheet.getCell(`A${farmerWorksheet.lastRow.number}`).value = {
//           text: row.farmer_id,
//           hyperlink: `#Products_${row.farmer_id}!A1`,
//           tooltip: `Go to Products for ${row.farmer_id}`
//         };
//       });

//       // Send excel file back
//       res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
//       res.setHeader('Content-Disposition', 'attachment; filename="farmers_and_products.xlsx"');
//       await workbook.xlsx.write(res);
//       res.end();
//     });

//   } catch (error) {
//     console.error('Error generating excel:', error);
//     res.status(500).json({ success: false, message: 'Internal Server Error' });
//   }
// });


app.get('/excel', async (req, res) => {
  const farmerStyles = {
    header: {
      font: { bold: true, size: 12, color: { argb: 'FFFFFF' } }, // ตัวอักษรหนา ขนาด 12 สีขาว
      alignment: { horizontal: 'center' },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: '2E74B5' } } // สีเขียว
    },
    downloadRow: {
      font: { bold: true, size: 10, color: { argb: '000000' } }, // ตัวอักษรหนา ขนาด 10 สีดำ
      alignment: { horizontal: 'right' },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD966' } } // สีเหลือง
    },
    totalRow: {
      font: { bold: true, size: 10, color: { argb: '000000' } }, // ตัวอักษรหนา ขนาด 10 สีดำ
      alignment: { horizontal: 'right' },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'CCFFCC' } } // สีเขียวอ่อน
    },
    middleRow: {
      font: { bold: true, size: 11, color: { argb: '0000FF' } }, // ตัวอักษรหนา ขนาด 11 สีน้ำเงิน
      alignment: { horizontal: 'right' },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF00' } } // สีเหลือง
    },
    THEBEST: {
      font: { bold: true, size: 50, color: { argb: '0000FF' } }, 
      alignment: { horizontal: 'center', vertical: 'middle' },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'a4ffa4' } } // สีเหลือง
    }
  };
  try {
    await usePooledConnectionAsync(async db => {
      // Query data of farmers
      const farmerSqlQuery = `
        SELECT 
          f.id AS farmer_id, 
          f.email, 
          f.username, 
          f.firstname, 
          f.lastname, 
          f.farmerstorename, 
          f.phone,
          COUNT(p.product_id) AS product_count
        FROM 
          farmers f
        LEFT JOIN 
          products p ON f.id = p.farmer_id
        GROUP BY
          f.id, f.email, f.username, f.firstname, f.lastname, f.farmerstorename, f.phone
      `;

      const farmersData = await new Promise((resolve, reject) => {
        db.query(farmerSqlQuery, (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });

      const workbook = new excel.Workbook();

      const farmerWorksheet = workbook.addWorksheet('Farmers', {
        properties: { tabColor: { argb: 'FF00BFFF' } },
        pageSetup: { paperSize: 9, orientation: 'landscape' }
      });
        farmerWorksheet.mergeCells('A1:H1');
        farmerWorksheet.getCell('A1').value = 'THE BEST KASET NONT';
        
        farmerWorksheet.eachRow(row => {
          row.eachCell(cell => {
            cell.font = farmerStyles.THEBEST.font;
            cell.alignment = farmerStyles.THEBEST.alignment;
            cell.fill = farmerStyles.THEBEST.fill;
          });
        });
      momentz.locale('th'); // กำหนดภาษาเป็นไทย
      const downloadDate = momentz.tz('Asia/Bangkok').format('DD-MM-YYYY HH:mm:ss');
      const totalFarmers = farmersData.length;

      const downloadRow = farmerWorksheet.addRow(['ข้อมูลออกณวันที่ :', downloadDate, '', '', '', '', '', '']);
      const totalRow = farmerWorksheet.addRow(['จำนวนเกษตรกรทั้งหมด :', totalFarmers, '', '', '', '', '', '']);
      farmerWorksheet.columns.forEach(column => {
        column.width = 25;
      });
      const farmerHeaders = ['รหัสเกษตรกร', 'อีเมล', 'ชื่อผู้ใช้เกษตรกร', 'ชื่อจริง', 'นามสกุล', 'ชื่อร้านค้า', 'หมายเลขโทรศัพท์', 'สินค้าที่ขายทั้งหมด'];

      const headerRow = farmerWorksheet.addRow(farmerHeaders);
      headerRow.eachCell(cell => {
        cell.font = farmerStyles.header.font;
        cell.alignment = farmerStyles.header.alignment;
        cell.fill = farmerStyles.header.fill;
      });



      farmerWorksheet.columns.forEach(column => {
        column.width = 25;
      });

      farmerWorksheet.views = [
        { state: 'frozen', xSplit: 0, ySplit: 1, activeCell: 'B2' }
      ];

      const farmerProductSheets = {};

      farmersData.forEach(row => {
        const rowData = [row.farmer_id, row.email, row.username, row.firstname, row.lastname, row.farmerstorename, row.phone, row.product_count];
        const farmerRow = farmerWorksheet.addRow(rowData);

        farmerWorksheet.getCell(`A${farmerRow.number}`).value = {
          text: row.farmer_id,
          hyperlink: `#Products_${row.farmer_id}!A1`,
          tooltip: `Go to Products for ${row.farmer_id}`
        };

        const productSheet = workbook.addWorksheet(`Products_${row.farmer_id}`, {
          properties: { tabColor: { argb: 'FF00FF00' } }
        });
        const productHeaders = ['รหัสสินค้า', 'ชื่อสินค้า', 'คงเหลือในคลัง', 'ราคา'];
        const productHead = productSheet.addRow(productHeaders);
        productHead.eachCell(cell => {
          cell.font = farmerStyles.header.font;
          cell.alignment = farmerStyles.header.alignment;
          cell.fill = farmerStyles.header.fill;
        });

        productSheet.columns.forEach(column => {
          column.width = 20;
        });
        farmerProductSheets[row.farmer_id] = productSheet;
      });

      for (const farmerId in farmerProductSheets) {
        const productSheet = farmerProductSheets[farmerId];
        const productsSqlQuery = `
          SELECT 
            product_id, 
            product_name, 
            stock, 
            price
          FROM 
            products
          WHERE 
            farmer_id = ?
        `;
        const productsData = await new Promise((resolve, reject) => {
          db.query(productsSqlQuery, [farmerId], (err, result) => {
            if (err) {
              reject(err);
            } else {
              resolve(result);
            }
          });
        });

        productsData.forEach(product => {
          const productData = [product.product_id, product.product_name, product.stock, product.price];
          const productRow = productSheet.addRow(productData);

          // แต่งสไตล์ของแถวข้อมูลในตาราง Product
          productRow.eachCell(cell => {
            cell.font = farmerStyles.middleRow.font;
            cell.alignment = farmerStyles.middleRow.alignment;
            cell.fill = farmerStyles.middleRow.fill;
          });
        });

        // เพิ่มลิงก์ที่ชี้กลับไปยังหน้ารายการเกษตรกร
        productSheet.getCell(`E${productSheet.lastRow.number}`).value = {
          text: 'กลับไปหน้าหลัก',
          hyperlink: '#Farmers!A1',
          tooltip: 'Go back to Farmers',
          font: { color: { argb: '0000FF' }, underline: true },
          alignment: { vertical: 'middle', horizontal: 'center' },
          border: {
            top: { style: 'thin', color: { argb: '000000' } },
            left: { style: 'thin', color: { argb: '000000' } },
            bottom: { style: 'thin', color: { argb: '000000' } },
            right: { style: 'thin', color: { argb: '000000' } },
          },
          fill: {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFF00' } // สีเหลือง
          },
          onClick: () => { window.location.href = '#Farmers!A1'; } // กระทำเมื่อคลิกที่ปุ่ม
        };
      }



      downloadRow.eachCell(cell => {
        cell.font = farmerStyles.downloadRow.font;
        cell.alignment = farmerStyles.downloadRow.alignment;
        cell.fill = farmerStyles.downloadRow.fill;
      });
      totalRow.eachCell(cell => {
        cell.font = farmerStyles.totalRow.font;
        cell.alignment = farmerStyles.totalRow.alignment;
        cell.fill = farmerStyles.totalRow.fill;
      });

      const currentDate = moment().format('YYYY-MM-DD_HH-mm-ss');
      const filename = `farmers_and_products_${currentDate}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      await workbook.xlsx.write(res);
      res.end();
    });
  } catch (error) {
    console.error('Error generating excel:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});
















app.post("/changepassword", async (req, res) => {
  const { oldpassword, newpassword, usernameBody, roleBody } = req.body;
  const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : null;

  const checkMatchPssword = async (role, username, password) => {
    return await usePooledConnectionAsync(async db => {
      const hashedPassword = await new Promise(async (resolve, reject) => {
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
    })
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
    await usePooledConnectionAsync(async db => {
      return await new Promise((resolve, reject) => {
        db.query(`UPDATE ${roleDecoded !== "admins" ? roleDecoded : roleBody} SET password = "${newHashedPassword}" WHERE username = "${roleDecoded !== "admins" ? usernameDecoded : usernameBody}"`, (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        })
      })
    });

    return res.status(200).json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

app.post('/certificate', checkAdmin, async (req, res) => {
  try {
    return await usePooledConnectionAsync(async db => {
      let { id, name } = req.body;
      //check if name exist
      const checkNameQuery = 'SELECT standard_name FROM standard_products WHERE standard_name = ? and available = 1';
      const [existingName] = await new Promise((resolve, reject) => {
        db.query(checkNameQuery, [name], (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });
      if (existingName && !id) {
        return res.status(400).json({ success: false, message: 'มาตรฐานสินค้าที่เพิ่มเข้ามามีอยู่ในระบบอยู่แล้ว' });
      }

      let query
      if (id) {
        query = `UPDATE standard_products SET standard_name = "${name}" WHERE standard_id = "${id}"`;
      }
      if (!id) {
        id = await new Promise(async (resolve, reject) => {
          db.query('SELECT MAX(standard_id) as maxId FROM standard_products', (err, result) => {
            if (err) {
              reject(err);
            } else {
              let nextId = 'ST000';
              if (result[0].maxId) {
                const currentId = result[0].maxId;
                const numericPart = parseInt(currentId.substring(2), 10) + 1;

                nextId = 'ST' + numericPart.toString().padStart(3, '0');
              }
              resolve(nextId);
            }
          });
        })
        query = `INSERT INTO standard_products (standard_id, standard_name) VALUES ("${id}", "${name}")`;
      }

      db.query(query, (err, result) => {
        if (err) {
          console.error('Error adding certificate:', err);
          return res.status(500).json({ success: false, message: 'Internal Server Error' });
        } else {
          return res.status(200).json({ success: true, message: 'Certificate added successfully', id });
        }
      });

    })

  } catch (error) {
    console.error('Error adding certificate:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }

})
app.delete('/certificate/', checkAdmin, async (req, res) => {
  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ success: false, message: 'Certificate ID is required' });
  }
  try {
    return await usePooledConnectionAsync(async db => {
      const query = `UPDATE standard_products SET available = 0 WHERE standard_id = "${id}"`;
      db.query(query, (err, result) => {
        if (err) {
          console.error('Error deleting certificate:', err);
          return res.status(500).json({ success: false, message: 'Internal Server Error' });
        } else {
          return res.status(200).json({ success: true, message: 'Certificate deleted successfully' });
        }
      });
    })
  } catch (error) {
    console.error('Error deleting certificate:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
})

app.listen(3001, () => console.log('Avalable 3001'));

const mysql = require("mysql2");
require("dotenv").config();
var db_config = {
  host: "localhost",
  socketPath:
    process.env.production == "true"
      ? "/var/run/mysqld/mysqld.sock"
      : undefined,
  user: process.env.production == "true" ? "thebestkasetnont" : "root",
  password: process.env.production == "true" ? "xGHYb$#34f2RIGhJc" : "",
  database:
    process.env.production == "true" ? "thebestkasetnont" : "kaset_data",
  charset: "utf8mb4",
  typeCast: function (field, next) {
    if (field.type === "TINY" && field.length === 1) {
      return field.string() === "1"; // 1 = true, 0 = false
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
module.exports = {
  usePooledConnectionAsync,
};

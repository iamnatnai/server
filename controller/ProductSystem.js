const secretKey = require("../middleware");
const { usePooledConnectionAsync } = require("../database");
async function getNextProductId() {
  return await usePooledConnectionAsync(async (db) => {
    return new Promise((resolve, reject) => {
      db.query(
        "SELECT MAX(product_id) as maxId FROM products",
        (err, result) => {
          if (err) {
            reject(err);
          } else {
            let nextId = "PROD000001";
            if (result[0].maxId) {
              const currentIdNumericPart = parseInt(
                result[0].maxId.substring(4),
                10
              );
              const nextNumericPart = currentIdNumericPart + 1;
              const paddedNextNumericPart = String(nextNumericPart).padStart(
                6,
                "0"
              );
              nextId = "PROD" + paddedNextNumericPart;
            }
            resolve(nextId);
          }
        }
      );
    });
  });
}
const StandardProduct = async (req, res) => {
  await usePooledConnectionAsync(async (db) => {
    db.query("SELECT * FROM standard_products", (err, result) => {
      if (err) {
        console.log(err);
        res.status(500).send({ exist: false, error: "Internal Server Error" });
      } else {
        res.json(result);
      }
    });
  });
};
const AddProduct = async (req, res) => {
  let {
    product_id,
    product_name,
    category_id,
    product_description,
    selectedType,
    price,
    unit,
    stock,
    product_image,
    product_video,
    additional_images,
    certificate,
    shippingcost,
  } = req.body;

  const token = req.headers.authorization
    ? req.headers.authorization.split(" ")[1]
    : null;
  try {
    await usePooledConnectionAsync(async (db) => {
      const decoded = jwt.verify(token, secretKey);
      let farmerId = null;
      if (decoded.role == "farmers") {
        farmerId = decoded.ID;
      } else {
        console.log(req.body.username);
        farmerId = await new Promise((resolve, reject) => {
          db.query(
            "SELECT ID FROM farmers WHERE username = ?",
            [req.body.username],
            (err, result) => {
              if (err) {
                reject(err);
              } else {
                if (result.length > 0) {
                  resolve(result[0].ID);
                } else {
                  reject("Farmer not found");
                }
              }
            }
          );
        });
      }
      if (product_id) {
        const query = `UPDATE products SET product_name = ?, product_description = ?, category_id = ?, stock = ?, price = ?, unit = ?, product_image = ?, product_video = ?, additional_image = ?, selectedType = ?, certificate = ?, shippingcost = ?, last_modified = NOW() WHERE product_id = ? and farmer_id = ?`;
        db.query(query, [
          product_name,
          product_description,
          category_id,
          stock,
          price,
          unit,
          product_image,
          product_video,
          additional_images,
          selectedType,
          certificate,
          shippingcost,
          product_id,
          farmerId,
        ]);
        return res
          .status(200)
          .send({ success: true, message: "Product updated successfully" });
      }
      const nextProductId = await getNextProductId();

      const query = `
          INSERT INTO products (product_id, farmer_id, product_name, product_description, category_id, stock, price, unit, product_image, product_video, additional_image,selectedType,certificate, shippingcost, last_modified)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `;
      db.query(
        query,
        [
          nextProductId,
          farmerId,
          product_name,
          product_description,
          category_id,
          stock,
          price,
          unit,
          product_image,
          product_video,
          additional_images,
          selectedType,
          certificate,
          shippingcost,
        ],
        (err, result) => {
          if (err) {
            console.error("Error adding product:", err);
            return res
              .status(500)
              .send({ success: false, message: "Internal Server Error" });
          }
          console.log("Product added successfully");
          return res
            .status(200)
            .send({ success: true, message: "Product added successfully" });
        }
      );
    });
  } catch (error) {
    console.error("Error adding product:", error);
    return res
      .status(500)
      .send({ success: false, message: "Internal Server Error" });
  }
};

const GetProduct = async (req, res) => {
  const { product_id, shopname } = req.params;
  console.log(product_id, shopname);
  await usePooledConnectionAsync(async (db) => {
    db.query(
      "SELECT p.* FROM products p LEFT JOIN farmers f ON p.farmer_id = f.id WHERE p.product_id = ? and f.farmerstorename = ? and p.available = 1;",
      [product_id, shopname],
      (err, result) => {
        if (err) {
          console.log(err);
          res
            .status(500)
            .send({ exist: false, error: "Internal Server Error" });
        } else {
          console.log(result[0]);
          res.json(result[0]);
        }
      }
    );
  });
};

const Getproducts = async (req, res) => {
  let { search, category, page, sort, order, perPage, groupby } = req.query;
  if (page < 1) {
    page = 1;
  }
  page -= 1;
  if (!perPage) {
    perPage = 40;
  }
  let queryMaxPage = `SELECT COUNT(*) as maxPage FROM products where available = 1 and ${
    search !== "" ? `${"product_name LIKE '%" + search + "%' AND"}` : ""
  } category_id = '${category}'`;
  let query = `SELECT p.*, f.lat, f.lng, f.farmerstorename FROM products p INNER JOIN farmers f ON p.farmer_id = f.id where p.available = 1 and ${
    search !== "" ? `${"product_name LIKE '%" + search + "%' AND"}` : ""
  } category_id = '${category}' ${
    groupby ? "group by p.farmer_id" : ""
  } ORDER BY ${sort} ${order} LIMIT ${perPage} OFFSET ${page * perPage}`;
  if (category == "") {
    queryMaxPage = `SELECT COUNT(*) as maxPage FROM products where available = 1 ${
      search !== "" ? `${`${"and product_name LIKE '%" + search + "%'"}`}` : ""
    }`;
    query = `SELECT p.*, f.lat, f.lng, f.farmerstorename FROM products p INNER JOIN farmers f ON p.farmer_id = f.id where p.available = 1 ${
      search !== "" ? `${"and product_name LIKE '%" + search + "%'"}` : ""
    } ${
      groupby ? "group by p.farmer_id" : ""
    } ORDER BY ${sort} ${order} LIMIT ${perPage} OFFSET ${page * perPage} `;
  }
  console.log(query);
  await usePooledConnectionAsync(async (db) => {
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
        res.status(500).send({ exist: false, error: "Internal Server Error" });
      } else {
        res.json({
          products: result,
          maxPage:
            AllPage % perPage === 0
              ? AllPage / perPage
              : Math.floor(AllPage / perPage) + 1,
        });
      }
    });
  });
};

const Deleteproduct = async (req, res) => {
  const { id } = req.params;
  const token = req.headers.authorization
    ? req.headers.authorization.split(" ")[1]
    : null;
  await usePooledConnectionAsync(async (db) => {
    //soft delete
    const decoded = jwt.verify(token, secretKey);
    let farmerId;
    if (decoded.role !== "farmers") {
      farmerId = decoded.ID;
    } else {
      farmerId = req.body.farmerId;
    }
    db.query(
      `UPDATE products SET available = 0 WHERE product_id = "${id}" and farmer_id = "${farmerId}"`,
      (err, result) => {
        if (err) {
          console.log(err);
          res
            .status(500)
            .send({ exist: false, error: "Internal Server Error" });
        } else {
          res.json({ success: true });
        }
      }
    );
  });
};

const Getupdatereview = async (req, res) => {
  const { id } = req.params;
  // update view_count + 1
  console.log(id);
  await usePooledConnectionAsync(async (db) => {
    db.query(
      "UPDATE products SET view_count = view_count + 1 WHERE product_id = ?",
      [id],
      (err, result) => {
        if (err) {
          console.log(err);
          res
            .status(500)
            .send({ exist: false, error: "Internal Server Error" });
        } else {
          res.json({ success: true });
        }
      }
    );
  });
};

const Getmyproduct = async (req, res) => {
  await usePooledConnectionAsync(async (db) => {
    const { username } = req.params;
    db.query(
      "SELECT p.product_id, p.product_image, p.product_description, p.product_name, p.selectedType, p.last_modified, p.price, p.view_count, p.category_id,c.category_name, f.farmerstorename FROM products p left join farmers f on p.farmer_id = f.id LEFT JOIN categories c on p.category_id = c.category_id WHERE p.farmer_id = (select id from farmers where username = ?) and p.available = 1;",
      [username],
      (err, result) => {
        if (err) {
          console.log(err);
          res
            .status(500)
            .send({ exist: false, error: "Internal Server Error" });
        } else {
          res.json(result);
        }
      }
    );
  });
};
module.exports = {
  AddProduct,
  StandardProduct,
  Getproducts,
  GetProduct,
  Deleteproduct,
  Getupdatereview,
  Getmyproduct,
};

app.get("/getpayment/:id", async (req, res) => {
  await usePooledConnectionAsync(async (db) => {
    const id = req.params.id;
    db.query(
      "SELECT payment FROM farmers WHERE id = (select farmer_id from products where product_id = ?)",
      [id],
      (err, result) => {
        if (err) {
          console.log(err);
          res
            .status(500)
            .send({ exist: false, error: "Internal Server Error" });
        } else {
          res.json(result[0]);
        }
      }
    );
  });
});
app.post(
  "/checkout",
  upload.fields([{ name: "productSlip", maxCount: 1 }]),
  async (req, res) => {
    let { cartList } = req.body;
    var SUMITNOW = 0;

    try {
      await usePooledConnectionAsync(async (db) => {
        cartList = JSON.parse(cartList);
        if (!cartList || !Array.isArray(cartList) || cartList.length === 0) {
          return res
            .status(400)
            .json({ success: false, message: "Empty or invalid cart data" });
        }
        const token = req.headers.authorization
          ? req.headers.authorization.split(" ")[1]
          : null;
        const decoded = jwt.verify(token, secretKey);
        await new Promise((resolve, reject) => {
          db.beginTransaction((err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        let idoffarmer;
        const getAddress = "SELECT address FROM members WHERE id = ?";
        const memberaddress = await new Promise((resolve, reject) => {
          db.query(getAddress, [decoded.ID], (err, result) => {
            if (err) {
              reject(err);
            } else {
              resolve(result);
            }
          });
        });
        const productSlipFile = req.files["productSlip"]
          ? req.files["productSlip"][0]
          : null;
        const productSlipPath = productSlipFile
          ? `./uploads/${productSlipFile.filename}`
          : null;
        let address;
        if (req.body.address) {
          address = req.body.address;
        } else {
          address = memberaddress[0].address;
        }
        console.log("-+-+-+-+--++--+-+-+-+-+-+-+-+-+-+-+");
        async function getNextORDID() {
          return new Promise((resolve, reject) => {
            db.query(
              "SELECT MAX(id) as maxId FROM order_sumary",
              (err, result) => {
                if (err) {
                  reject(err);
                } else {
                  let ORDNXT = "ORD00001";
                  if (result[0].maxId) {
                    const currentId = result[0].maxId;
                    console.log(currentId);
                    const numericPart =
                      parseInt(currentId.substring(3), 10) + 1;
                    console.log(numericPart);
                    ORDNXT = "ORD" + numericPart.toString().padStart(5, "0");
                  }
                  resolve(ORDNXT);
                }
              }
            );
          });
        }
        const ORDNXT = await getNextORDID();
        const insertOrderVB =
          "INSERT INTO order_sumary (id,status,total_amount,member_id,transaction_confirm,address,date_buys) VALUES (?,?,?,?,?,?,NOW())";
        await new Promise((resolve, reject) => {
          db.query(
            insertOrderVB,
            [ORDNXT, "pending", SUMITNOW, decoded.ID, productSlipPath, address],
            (err, result) => {
              if (err) {
                reject(err);
              } else {
                resolve(result);
              }
              console.log("ORDNXT", ORDNXT);
            }
          );
        });
        for (const item of cartList) {
          const { product_id, amount } = item;
          console.log(decoded);
          const getProductQuery =
            "SELECT stock, farmer_id, selectedType FROM products WHERE product_id = ?";
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
            idoffarmer = product.farmer_id;
          } else if (idoffarmer != product.farmer_id) {
            return res.status(400).json({
              success: false,
              message: "Cart items must be from the same farmer",
            });
          }
          if (product.selectedType != "สินค้าจัดส่งพัสดุ") {
            return res
              .status(400)
              .json({ success: false, message: "Order Has Not avalable" });
          }
          const getProductPriceQuery =
            "SELECT price FROM products WHERE product_id = ?";
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
          SUMITNOW = SUMITNOW + totalProductPrice;
          console.log("total : ", totalProductPrice);
          console.log(product.farmer_id);
          console.log(cartList[0].farmer_id);
          if (!product || product.length === 0) {
            console.error(`Product ID ${product_id} not found`);
            return res
              .status(400)
              .send({ error: `Product ID ${product_id} not found` });
          }
          if (amount <= 0) {
            console.error(`Insufficient stock for product ID ${product_id}`);
            return res.status(400).send({ error: `NOT TRUE` });
          }
          const currentStock = product.stock; // Corrected to access the stock property
          if (amount > currentStock) {
            console.error(`Insufficient stock for product ID ${product_id}`);
            return res.status(400).send({
              error: `Insufficient stock for product ID ${product_id}`,
            });
          }
          const newStock = currentStock - amount;
          const updateStockQuery =
            "UPDATE products SET stock = ? WHERE product_id = ?";
          await new Promise((resolve, reject) => {
            db.query(
              updateStockQuery,
              [newStock, product_id],
              (err, result) => {
                if (err) {
                  reject(err);
                } else {
                  resolve(result);
                }
              }
            );
          });
          async function getNextItemId() {
            return new Promise((resolve, reject) => {
              db.query(
                "SELECT MAX(item_id) as maxId FROM order_items",
                (err, result) => {
                  if (err) {
                    reject(err);
                  } else {
                    let nextId = "ITEM00001";
                    if (result[0].maxId) {
                      const currentId = result[0].maxId;
                      console.log(currentId);
                      const numericPart =
                        parseInt(currentId.substring(4), 10) + 1;
                      console.log(numericPart);
                      nextId = "ITEM" + numericPart.toString().padStart(5, "0");
                    }
                    resolve(nextId);
                  }
                }
              );
            });
          }
          console.log("++++++");
          console.log(decoded.ID);
          const nextitemId = await getNextItemId();
          const insertOrderItemQuery =
            "INSERT INTO order_items (item_id,product_id,order_id,price, quantity) VALUES (?,?,?,?,?)";
          await new Promise((resolve, reject) => {
            db.query(
              insertOrderItemQuery,
              [nextitemId, product_id, ORDNXT, totalProductPrice, amount],
              (err, result) => {
                if (err) {
                  reject(err);
                } else {
                  resolve(result);
                }
                console.log("nextitemId");
                console.log(nextitemId);
              }
            );
          });
        }
        const updateSUM =
          "UPDATE order_sumary SET total_amount = ? WHERE id = ?";
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
          db.commit((err) => {
            if (err) {
              db.rollback(() => {
                reject(err);
              });
            } else {
              resolve();
            }
          });
        });

        res.status(200).json({ success: true, message: "Checkout completed" });
      });
    } catch (error) {
      console.error("Error during checkout:", error);

      // Rollback transaction
      await new Promise((resolve, reject) => {
        db.rollback((err) => {
          if (err) {
            reject(err);
          } else {
            console.log("Transaction rolled back.");
            resolve();
          }
        });
      });

      return res
        .status(500)
        .json({ success: false, message: "Internal Server Error" });
    }
  }
);
app.post("/farmerorder", async (req, res) => {
  try {
    await usePooledConnectionAsync(async (db) => {
      const { order_id, status } = req.body;
      async function addComment(order_id, comment) {
        const insertCommentQuery =
          "UPDATE order_sumary SET comment = ? WHERE id = ?";
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

      const updateDonedate =
        "UPDATE order_sumary SET date_complete = NOW() WHERE id = ?";
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
        return res
          .status(400)
          .json({ success: false, message: "Incomplete request data" });
      }

      if (status === "complete") {
        // Update comment to null for complete status
        await addComment(order_id, null);
      } else if (status === "reject") {
        const { comment } = req.body;
        if (!comment) {
          return res.status(400).json({
            success: false,
            message: "Comment is required for rejection",
          });
        }
        await addComment(order_id, comment);
      }

      // Update order status in the database
      const updateOrderStatusQuery =
        "UPDATE order_sumary SET status = ? WHERE id = ?";
      await new Promise((resolve, reject) => {
        db.query(updateOrderStatusQuery, [status, order_id], (err, result) => {
          if (err) {
            reject(err);
          } else {
            if (result.affectedRows === 0) {
              return res
                .status(404)
                .json({ success: false, message: "Order not found" });
            }
            resolve(result);
          }
        });
      });

      return res
        .status(200)
        .json({ success: true, message: "Order status updated successfully" });
    });
  } catch (error) {
    console.error("Error updating order status:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
});

app.get("/orderlist", async (req, res) => {
  try {
    await usePooledConnectionAsync(async (db) => {
      const token = req.headers.authorization
        ? req.headers.authorization.split(" ")[1]
        : null;
      const decoded = jwt.verify(token, secretKey);
      const orderQuery = "SELECT * FROM order_sumary WHERE member_id = ?";
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
                const orderItemsQuery =
                  "SELECT oi.product_id, p.product_name, p.product_image, oi.quantity, oi.price FROM order_items oi INNER JOIN products p ON oi.product_id = p.product_id WHERE oi.order_id = ?";
                db.query(orderItemsQuery, [order.id], async (err, result) => {
                  if (err) {
                    reject(err);
                  } else {
                    Promise.all(
                      result.map(async (product) => {
                        return await new Promise((resolve, reject) => {
                          const getCommentQuery =
                            "SELECT rating, date_comment, comment FROM product_reviews WHERE product_id = ? and order_id = ? and available = 1";
                          db.query(
                            getCommentQuery,
                            [product.product_id, order.id],
                            (err, result) => {
                              if (err) {
                                reject(err);
                              } else {
                                resolve({
                                  product_id: product.product_id,
                                  product_name: product.product_name,
                                  product_image: product.product_image,
                                  quantity: product.quantity,
                                  price: product.price,
                                  comment: result[0] ? result[0] : null,
                                });
                              }
                            }
                          );
                        });
                      })
                    ).then((formattedProducts) => {
                      resolve(formattedProducts);
                    });
                  }
                });
              });
              order.products = products;
              order.date_buys = new Date(order.date_buys).toLocaleString();
              order.date_complete = order.date_complete
                ? new Date(order.date_complete).toLocaleString()
                : null;
              console.log(
                "++++++++++++++++++++++++++++++++++++++++++++++",
                order.date_complete
              );
              delete order.member_id;
            }
            resolve(result);
          }
        });
      });
      res.status(200).json({ success: true, orders: orders });
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

app.post(
  "/confirmtrancsaction",
  upload.fields([{ name: "productSlip", maxCount: 1 }]),
  async (req, res) => {
    try {
      const productSlipFile = req.files["productSlip"]
        ? req.files["productSlip"][0]
        : null;
      const productSlipPath = productSlipFile
        ? `./uploads/${productSlipFile.filename}`
        : null;

      const token = req.headers.authorization
        ? req.headers.authorization.split(" ")[1]
        : null;
      const decoded = jwt.verify(token, secretKey);

      // Check if product slip file exists in the request
      if (!productSlipFile) {
        return res
          .status(400)
          .json({ success: false, message: "Product slip file is required" });
      }

      // Extract order_id from the request
      const { order_id } = req.body;
      const orderQuery =
        "UPDATE order_sumary SET transaction_confirm = ? ,status = ? WHERE id = ? AND member_id = ?";

      const updatedOrders = await usePooledConnectionAsync(async (db) => {
        return await new Promise(async (resolve, reject) => {
          db.query(
            orderQuery,
            [productSlipPath, "pending", order_id, decoded.ID],
            (err, result) => {
              if (err) {
                reject(err);
              } else {
                resolve(result);
              }
            }
          );
        });
      });

      // Return success response with the updated orders
      res.status(200).json({
        success: true,
        message: "Order transaction confirmation updated successfully",
        orders: updatedOrders,
      });
    } catch (error) {
      // Handle errors
      console.error("Error updating order transaction confirmation:", error);
      res
        .status(500)
        .json({ success: false, message: "Internal Server Error" });
    }
  }
);

app.get("/farmerorder", async (req, res) => {
  try {
    const token = req.headers.authorization
      ? req.headers.authorization.split(" ")[1]
      : null;
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
    const orderItemsResult = await usePooledConnectionAsync(async (db) => {
      return await new Promise(async (resolve, reject) => {
        db.query(orderItemsQuery, [decoded.ID], (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });
    });

    const farmerOrdersMap = new Map();
    orderItemsResult.forEach((orderItem) => {
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
            address: orderItem.address,
          },
          date_buys: new Date(orderItem.date_buys).toLocaleString(),
          date_complete: orderItem.date_complete
            ? new Date(orderItem.date_complete).toLocaleString()
            : null,
          status: orderItem.status,
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
    console.error("Error fetching farmer orders:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

app.post("/confirmorder", async (req, res) => {
  try {
    const { order_id, status, comment, tracking_number } = req.body;
    if (!order_id || !status) {
      return res
        .status(400)
        .json({ success: false, message: "Incomplete request data" });
    }

    if (status !== "complete" && status !== "reject" && status !== "waiting") {
      return res
        .status(400)
        .json({ success: false, message: "Invalid status" });
    }
    console.log(req.body);

    const updateOrderStatusQuery = `UPDATE order_sumary SET status = ? ${
      comment ? `,comment = "${comment}"` : ""
    } ${
      status == "complete"
        ? `${`,tracking_number = "${tracking_number}",date_complete = NOW()`}`
        : ""
    } WHERE id = ?`;
    console.log(updateOrderStatusQuery);
    const updatedOrders = await usePooledConnectionAsync(async (db) => {
      return await new Promise(async (resolve, reject) => {
        db.query(updateOrderStatusQuery, [status, order_id], (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });
    });

    res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      orders: updatedOrders,
    });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

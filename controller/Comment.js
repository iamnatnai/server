const secretKey = require("../middleware");
const Postcomment = async (req, res) => {
  const { rating, comment, product_id, order_id } = req.body;
  try {
    const token = req.headers.authorization
      ? req.headers.authorization.split(" ")[1]
      : null;
    const decoded = jwt.verify(token, secretKey);

    async function getNextReviewId() {
      return await usePooledConnectionAsync(async (db) => {
        return new Promise(async (resolve, reject) => {
          db.query(
            "SELECT MAX(review_id) as maxId  FROM product_reviews",
            (err, result) => {
              if (err) {
                reject(err);
              } else {
                let nextRev = "REV0000001";
                if (result[0].maxId) {
                  const currentId = result[0].maxId;
                  const numericPart = parseInt(currentId.substring(3), 10) + 1;
                  nextRev = "REV" + numericPart.toString().padStart(7, "0");
                }
                resolve(nextRev);
              }
            }
          );
        });
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
    const orderResult = await usePooledConnectionAsync(async (db) => {
      return await new Promise(async (resolve, reject) => {
        db.query(
          checkOrderStatusQuery,
          [decoded.ID, product_id],
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

    if (!orderResult || orderResult.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "Member has not purchased this product or order is not complete",
      });
    }

    // Check if all necessary data is provided
    if (!decoded.ID || !product_id || !rating) {
      return res
        .status(400)
        .json({ success: false, message: "Incomplete comment data" });
    }

    // Check if rating is valid
    if (rating < 1 || rating > 5) {
      return res
        .status(400)
        .json({ success: false, message: "Rating must be between 1 and 5" });
    }

    // Check if the member has purchased the product

    await usePooledConnectionAsync(async (db) => {
      const checkOrderQuery =
        "SELECT os.id AS order_id FROM order_sumary os INNER JOIN order_items oi ON os.id = oi.order_id WHERE os.member_id = ? AND oi.product_id = ?";
      const [orderResult] = await new Promise(async (resolve, reject) => {
        db.query(checkOrderQuery, [decoded.ID, product_id], (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });

      const checkDuplicateOrderQuery =
        "SELECT * FROM product_reviews WHERE order_id = ? AND product_id = ?";
      const duplicateOrders = await new Promise(async (resolve, reject) => {
        db.query(
          checkDuplicateOrderQuery,
          [order_id, product_id],
          (err, result) => {
            // เพิ่มเงื่อนไขในการตรวจสอบซ้ำด้วย product_id
            if (err) {
              reject(err);
            } else {
              console.log(result);
              console.log(product_id);
              resolve(result);
            }
          }
        );
      });

      console.log("birdddddddddddddd");
      console.log(duplicateOrders);

      if (duplicateOrders.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Order ID already exists in product reviews",
        });
      }

      if (!orderResult || orderResult.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Member has not purchased this product",
        });
      }

      const nextReviewId = await getNextReviewId();

      const insertCommentQuery =
        "INSERT INTO product_reviews (review_id, member_id, rating, comment, product_id,order_id,date_comment) VALUES (?, ?, ?, ?, ?, ?,NOW())";
      console.log(orderResult.order_id);

      db.query(
        insertCommentQuery,
        [nextReviewId, decoded.ID, rating, comment, product_id, order_id],
        (err, result) => {
          if (err) {
            console.error("Error adding comment:", err);
          } else {
            return res
              .status(200)
              .json({ success: true, message: "Comment added successfully" });
          }
        }
      );
    });
  } catch (error) {
    console.error("Error adding comment:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};
const GetComment = async (req, res) => {
  const id = req.params.id;
  console.log(id);
  if (!id) {
    return res
      .status(400)
      .json({ success: false, error: "Invalid product ID" });
  }
  await usePooledConnectionAsync(async (db) => {
    db.query(
      'SELECT pr.review_id, pr.member_id, m.username AS member_username, pr.product_id, pr.order_id, pr.rating, pr.comment, DATE_FORMAT(pr.date_comment, "%Y-%m-%d %H:%i:%s") AS date_comment FROM product_reviews pr LEFT JOIN members m ON pr.member_id = m.id WHERE pr.product_id = ? AND pr.available = 1',
      [id],
      (err, result) => {
        if (err) {
          console.error(err);
          return res
            .status(500)
            .json({ success: false, error: "Internal Server Error" });
        }
        // ส่งข้อมูลความคิดเห็นกลับไปในรูปแบบ JSON
        res.json({ success: true, reviews: result });
      }
    );
  });
};
const EditComment = async (req, res) => {
  const commentId = req.params.id;
  const { rating, comment } = req.body;
  const token = req.headers.authorization
    ? req.headers.authorization.split(" ")[1]
    : null;
  const decoded = jwt.verify(token, secretKey);
  // ตรวจสอบค่า ID ที่รับเข้ามา
  if (!commentId) {
    return res
      .status(400)
      .json({ success: false, error: "Invalid comment ID" });
  }

  try {
    await usePooledConnectionAsync(async (db) => {
      const getCommentQuery =
        "SELECT * FROM product_reviews WHERE review_id = ?";
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
        return res
          .status(403)
          .json({ success: false, error: "Unauthorized access" });
      }
      if (rating < 1 || rating > 5) {
        return res
          .status(400)
          .json({ success: false, message: "Rating must be between 1 and 5" });
      }
      if (!existingComment) {
        return res
          .status(404)
          .json({ success: false, error: "Comment not found" });
      }
      const updateCommentQuery =
        "UPDATE product_reviews SET rating = ?, comment = ? WHERE review_id = ?";
      const EDITC = await new Promise((resolve, reject) => {
        db.query(
          updateCommentQuery,
          [rating, comment, commentId],
          (err, result) => {
            if (err) {
              reject(err);
            } else {
              resolve(result);
            }
          }
        );
      });
      console.log(EDITC);
      res
        .status(200)
        .json({ success: true, message: "Comment updated successfully" });
    });
  } catch (error) {
    console.error("Error editing comment:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const DeleteComment = async (req, res) => {
  const commentId = req.params.id;
  const token = req.headers.authorization
    ? req.headers.authorization.split(" ")[1]
    : null;
  const decoded = jwt.verify(token, secretKey);

  // ตรวจสอบค่า ID ที่รับเข้ามา
  if (!commentId) {
    return res
      .status(400)
      .json({ success: false, error: "Invalid comment ID" });
  }
  try {
    // เชื่อมต่อกับฐานข้อมูลเพื่อดึงข้อมูลความคิดเห็น
    await usePooledConnectionAsync(async (db) => {
      const getCommentQuery =
        "SELECT * FROM product_reviews WHERE review_id = ?";
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
        return res
          .status(403)
          .json({ success: false, error: "Unauthorized access" });
      }
      const softDeleteCommentQuery =
        "UPDATE product_reviews SET available = 0 WHERE review_id = ?";
      await new Promise((resolve, reject) => {
        db.query(softDeleteCommentQuery, [commentId], (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });
    });
    res
      .status(200)
      .json({ success: true, message: "Comment soft deleted successfully" });
  } catch (error) {
    console.error("Error soft deleting comment:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

module.exports = {
  Postcomment,
  GetComment,
  EditComment,
  DeleteComment,
};

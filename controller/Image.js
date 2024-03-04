const secretKey = require("../middleware");
const Getimagepath = (req, res) => {
  const image = req.params.image;
  res.sendFile(path.join(__dirname, "uploads", image));
};
const IMAGESTORE = async (req, res) => {
  const token = req.headers.authorization
    ? req.headers.authorization.split(" ")[1]
    : null;
  if (!token) {
    return res.status(400).json({ error: "Token not provided" });
  }
  try {
    const decoded = jwt.verify(token, secretKey);

    const imageQuery = "SELECT imagepath FROM image WHERE farmer_id = ?";
    const images = await usePooledConnectionAsync(async (db) => {
      return await new Promise(async (resolve, reject) => {
        db.query(imageQuery, [decoded.ID], (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });
    });
    let allimage = {
      images: [],
      videos: [],
    };
    images.forEach((image) => {
      if (image.imagepath.match(/\.(mp4|webm|ogg|ogv|avi|mov|wmv|flv|3gp)$/i)) {
        allimage.videos.push(image.imagepath);
      } else {
        allimage.images.push(image.imagepath);
      }
    });
    res.status(200).json({ ...allimage });
  } catch (error) {
    console.error("Error fetching images:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
const IMAGEUPLOAD = async (req, res) => {
  try {
    const token = req.headers.authorization
      ? req.headers.authorization.split(" ")[1]
      : null;
    const decoded = jwt.verify(token, secretKey);
    if (!req.files["image"]) {
      return res
        .status(400)
        .json({ success: false, message: "No images uploaded" });
    }
    const imagePaths = req.files["image"]
      ? req.files["image"].map((file) => `./uploads/${file.filename}`)
      : null;
    imagePaths.map(async (imagePath, index) => {
      async function getNextImageId(index) {
        return await usePooledConnectionAsync(async (db) => {
          return await new Promise(async (resolve, reject) => {
            db.query("SELECT MAX(id) as maxId FROM image", (err, result) => {
              if (err) {
                reject(err);
              } else {
                console.log(result);
                let nextimageId = "IMG000000001";
                if (result[0].maxId) {
                  const currentId = result[0].maxId;
                  const numericPart =
                    parseInt(currentId.substring(3), 10) + 1 + index;
                  console.log(
                    numericPart,
                    numericPart.toString().padStart(9, "0")
                  );
                  nextimageId = "IMG" + numericPart.toString().padStart(9, "0");
                }
                resolve(nextimageId);
              }
            });
          });
        });
      }
      const nextimageId = await getNextImageId(index);
      const insertImageQuery =
        "INSERT INTO image (id, imagepath, farmer_id) VALUES (?,?, ?)";
      await usePooledConnectionAsync(async (db) => {
        await new Promise(async (resolve, reject) => {
          db.query(
            insertImageQuery,
            [nextimageId, imagePath, decoded.ID],
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
    });

    res
      .status(200)
      .json({ success: true, message: "Images uploaded successfully" });
  } catch (error) {
    // Handle errors
    console.error("Error uploading images:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
module.exports = {
  Getimagepath,
  IMAGEUPLOAD,
  IMAGESTORE,
};

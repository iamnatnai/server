const bcrypt = require("bcrypt");
async function checkIfEmailAndNameMatch(email) {
  return await usePooledConnectionAsync(async (db) => {
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
            console.error("Error checking email and name in database:", err);
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

const Forgot = async (req, res) => {
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
    console.error("Error in forgot endpoint:", error);
    res.status(500).json({ email: "false" });
  }
};

function generateRandomPassword() {
  const length = 10;
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let newPassword = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    newPassword += charset[randomIndex];
  }
  return newPassword;
}

function sendNewPasswordByEmail(email, newPassword) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "thebestkasetnont@gmail.com",
      pass: "ggtf brgm brip mqvq",
    },
  });

  const mailOptions = {
    from: "thebestkasetnont@gmail.com",
    to: email,
    subject: "Your New Password",
    text: `Your new password is: ${newPassword}`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error("Error sending email:", error);
    } else {
      console.log("Email sent:", info.response);
    }
  });
}
function hashPassword(password) {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

async function updatePasswordInDatabase(email, newPassword) {
  try {
    await usePooledConnectionAsync(async (db) => {
      const hashedPassword = await hashPassword(newPassword);

      db.query(
        "UPDATE members SET password = ? WHERE email = ?",
        [hashedPassword, email],
        (err, result) => {
          if (err) {
            console.error("Error updating password in database:", err);
          } else {
            console.log("Password updated in database");
          }
        }
      );
    });
  } catch (error) {
    console.error("Error hashing password:", error);
  }
}
module.exports = {
  Forgot,
};

const postLogin = async (req, res) => {
  const { username, password } = req.body;
  console.log(123);
  if (!username || !password) {
    return res
      .status(400)
      .send({ status: false, error: "Missing required fields" });
  }

  try {
    const user = await getUserByUsername(username);

    if (!user) {
      return res
        .status(401)
        .send({ status: false, error: "Invalid username or password" });
    }
    console.log("User:", user.uze_name);
    console.log("Password:", password);
    console.log("Hash Password:", user.pazz);
    console.log("role:", user.role);
    console.log("+++++++++++++++++++++++++++++++++++++++");
    const passwordMatch = await bcrypt.compare(password, user.pazz);

    if (!passwordMatch) {
      console.log("not");
      return res
        .status(401)
        .send({ status: false, error: "Invalid username or password" });
    }

    const token = jwt.sign(
      { username: user.uze_name, ID: user.user_id, role: user.role },
      secretKey,
      {
        expiresIn: "15d",
      }
    );

    console.log("Generated token:", token);

    res.status(200).send({
      status: true,
      memberId: user.user_id,
      username: user.uze_name,
      role: user.role,
      token: token,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ status: false, error: "Internal Server Error" });
  }
};

const getLogin = (req, res) => {
  const token = req.headers.authorization
    ? req.headers.authorization.split(" ")[1]
    : null;

  if (!token) {
    return res.status(400).json({ error: "Token not provided" });
  }
  try {
    const decoded = jwt.verify(token, secretKey);
    const newToken = jwt.sign(
      { username: decoded.username, ID: decoded.ID, role: decoded.role },
      secretKey,
      {
        expiresIn: "15d",
      }
    );

    return res.status(200).json({ isValid: true, newToken: newToken });
  } catch (error) {
    console.error("Error decoding token:4", error.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
const hello = (req, res) => {
  res.status(200).send("Hello");
};
const hello2 = (req, res) => {
  res.status(200).send("Hello2");
};
module.exports = {
  postLogin,
  getLogin,
  hello,
  hello2,
};

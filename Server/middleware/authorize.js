// Server/middleware/authorize.js
const jwt = require("jsonwebtoken");

function authorize(req, res, next) {
  // 1. Get the token from the request header
  const authHeader = req.header("Authorization");
  const token = authHeader && authHeader.split(" ")[1];

  // 2. If no token is found, send an Unauthorized error
  if (!token) {
    return res.status(401).json({ ok: false, error: "Access denied. No token provided." });
  }

  try {
    // 3. Verify the token using the secret key
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 4. If valid, attach the decoded payload to the request object
    req.user = decoded;

    // 5. Continue to the next middleware or route handler
    next();
  } catch (ex) {
    // 6. If the token is invalid, send an error
    res.status(400).json({ ok: false, error: "Invalid token." });
  }
}

module.exports = authorize;
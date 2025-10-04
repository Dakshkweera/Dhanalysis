import admin from "../config/firebase.js";

export const verifyFirebaseToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = { uid: decoded.uid };
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
};

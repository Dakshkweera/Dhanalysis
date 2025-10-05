import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";

const app = express();
// app.use(cors());
app.use(cors({
  origin: 'http://localhost:5173'
}));

app.use(express.json());

app.get("/", (req, res) => res.send("Backend running"));

export default app;


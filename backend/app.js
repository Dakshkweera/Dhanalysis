import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";

const app = express();
// app.use(cors());a
const allowedOrigins = [
  'https://dhanalysis.vercel.app',
  'https://dhanalysis-git-main-daksh-kweeras-projects.vercel.app',
  'https://dhanalysis-obm4m5360-daksh-kweeras-projects.vercel.app',
  'http://localhost:5173'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, SSR)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));



app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => res.send("Backend running"));

export default app;


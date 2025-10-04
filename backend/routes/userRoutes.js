// /routes/userRoutes.js
import express from 'express';
import { createUser } from '../controllers/userController.js';

const router = express.Router();

// Endpoint for creating user after Firebase signup/login
router.post('/create', createUser);

export default router;

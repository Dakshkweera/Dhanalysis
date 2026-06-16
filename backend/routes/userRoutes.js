// /routes/userRoutes.js
import express from 'express';
import { createUser, updateUserProfile, getUserProfile } from '../controllers/userController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/create',        verifyToken, createUser);
router.put('/update-profile', verifyToken, updateUserProfile);
router.get('/:userId',        verifyToken, getUserProfile);

export default router;

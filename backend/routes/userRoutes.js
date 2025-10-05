// /routes/userRoutes.js
import express from 'express';
import { createUser } from '../controllers/userController.js';
import { updateUserProfile } from '../controllers/userController.js';
import { getUserProfile } from '../controllers/userController.js';



const router = express.Router();

// Endpoint for creating user after Firebase signup/login
router.post('/create', createUser);
router.put('/update-profile', updateUserProfile);
router.get('/:userId', getUserProfile); 

export default router;

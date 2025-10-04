
import User from '../models/User.js';

export const createUser = async (req, res) => {
  try {
    const { uid, email } = req.body;

    // Basic validation
    if (!uid || !email) {
      return res.status(400).json({ error: 'UID and email are required' });
    }

    // Check if user already exists
    let user = await User.findOne({ uid });

    if (!user) {
      // Create new user
      user = new User({ uid, email, firstInvestmentDate: null });
      await user.save();
    }

    return res.status(200).json({ message: 'User created or exists', user });
    
  } catch (error) {
    console.error('User creation error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

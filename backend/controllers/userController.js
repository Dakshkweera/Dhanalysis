// backend/controllers/userController.js
// Manages user profile — create, read, and update.
// Note: account creation (register) lives in authController.js.
// These endpoints handle onboarding profile fields set after signup.

import User from '../models/User.js';

// ── POST /api/users/create ────────────────────────────────────────────────────
// Creates a user record if one doesn't already exist for this UID.
// Called after registration to store onboarding fields (profession, goals, etc.)

export const createUser = async (req, res) => {
  try {
    const { uid, email, name, profession, investmentGoals, riskAppetite, age, annualIncome, investmentExperience } = req.body;

    if (!uid || !email) {
      return res.status(400).json({ error: 'UID and email are required' });
    }

    let user = await User.findOne({ uid });

    if (!user) {
      user = new User({
        uid,
        email,
        name: name || 'User',
        profession: profession || null,
        investmentGoals: investmentGoals || null,
        riskAppetite: riskAppetite || 'Medium',
        age: age || null,
        annualIncome: annualIncome || null,
        investmentExperience: investmentExperience || 'Beginner',
        firstInvestmentDate: null
      });
      await user.save();
    }

    return res.status(200).json({ message: 'User created or exists', user });

  } catch (error) {
    console.error('User creation error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

// ── PUT /api/users/update-profile ─────────────────────────────────────────────
// Updates onboarding/profile fields for an existing user.

export const updateUserProfile = async (req, res) => {
  try {
    const {
      uid, name, profession, investmentGoals, riskAppetite, age, annualIncome, investmentExperience
    } = req.body;

    if (!uid) {
      return res.status(400).json({ error: 'UID is required' });
    }

    if (uid !== req.user.uid) {
      return res.status(403).json({ error: 'Forbidden: cannot update another user\'s profile.' });
    }

    const user = await User.findOneAndUpdate(
      { uid },
      { name, profession, investmentGoals, riskAppetite, age, annualIncome, investmentExperience },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({ message: 'Profile updated', user });
  } catch (error) {
    console.error('Profile update error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

// ── GET /api/users/:userId ────────────────────────────────────────────────────
// Returns the public profile of a user by their UID.
// Excludes sensitive fields (__v, timestamps, passwordHash).

export const getUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'UserId parameter is required' });
    }

    const user = await User.findOne({ uid: userId }).select('-__v -createdAt -updatedAt -passwordHash');

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    return res.status(200).json({ success: true, user });

  } catch (error) {
    console.error('Error fetching user profile:', error);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
};

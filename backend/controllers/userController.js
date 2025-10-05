
import User from '../models/User.js';

export const createUser = async (req, res) => {
  try {
    const { uid, email, name, profession, investmentGoals, riskAppetite, age, annualIncome, investmentExperience } = req.body;

    // Basic validation
    if (!uid || !email) {
      return res.status(400).json({ error: 'UID and email are required' });
    }

    // Check if user already exists
    let user = await User.findOne({ uid });

    if (!user) {
      // Create new user with onboarding fields if provided
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

    // If user exists, consider updating onboarding fields separately (PUT /update-profile)

    return res.status(200).json({ message: 'User created or exists', user });
    
  } catch (error) {
    console.error('User creation error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};


export const updateUserProfile = async (req, res) => {
  try {
    const {
      uid, name, profession, investmentGoals, riskAppetite, age, annualIncome, investmentExperience
    } = req.body;

    if (!uid) {
      return res.status(400).json({ error: 'UID is required' });
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


export const getUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'UserId parameter is required' });
    }

    const user = await User.findOne({ uid: userId }).select('-__v -createdAt -updatedAt');

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    return res.status(200).json({ success: true, user });

  } catch (error) {
    console.error('Error fetching user profile:', error);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
};
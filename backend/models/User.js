import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  uid: {
    type: String,
    required: true,
    unique: true
  },
  email: {                     
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  name: {                        // ← Added name field (required for onboarding)
    type: String,
    default: 'User'
  },
  profession: {                  // ← New field added
    type: String,
    default: null
  },
  investmentGoals: {             // ← New field added
    type: String,
    default: null
  },
  riskAppetite: {               // ← Optional but useful
    type: String,
    enum: ['Low', 'Medium', 'High'],
    default: 'Medium'
  },
  age: {                        // ← Optional / Future
    type: Number,
    default: null
  },
  annualIncome: {               // ← Optional / Future
    type: Number,
    default: null
  },
  investmentExperience: {       // ← Optional / Future
    type: String,
    enum: ['Beginner', 'Intermediate', 'Expert'],
    default: 'Beginner'
  },
  firstInvestmentDate: {
    type: Date,
    default: null        // changed required to default null (safer)
  },
  notifications: {              // Optional notification settings
    email: {
      type: Boolean,
      default: true           // On by default
    }
  }
}, { 
  timestamps: true 
});

export default mongoose.model('User', userSchema);

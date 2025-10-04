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
  name: {                           // ← ADD THIS (optional)
    type: String,
    default: 'User'
  },
  firstInvestmentDate: {
    type: Date,
    required: true
  },
  notifications: {                  // ← ADD THIS
    email: {
      type: Boolean,
      default: true                 // Email notifications ON by default
    }
  }
}, { 
  timestamps: true 
});

export default mongoose.model('User', userSchema);

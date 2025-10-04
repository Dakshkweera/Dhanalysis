import mongoose from 'mongoose';

const stockMetadataSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    default: ''
  },
  sector: {
    type: String,
    default: 'Others'
  },
  industry: {
    type: String,
    default: 'N/A'
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

export default mongoose.model('StockMetadata', stockMetadataSchema);

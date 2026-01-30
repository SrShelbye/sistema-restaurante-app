const mongoose = require('mongoose');

const productionAreaSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  description: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  }
}, {
  timestamps: true
});

// Indexes
productionAreaSchema.index({ restaurantId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('ProductionArea', productionAreaSchema);

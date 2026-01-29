const mongoose = require('mongoose');

const restaurantSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  logo: String,
  address: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  capacity: {
    type: Number,
    required: true,
    min: 1,
    max: 1000
  },
  description: {
    type: String,
    maxlength: 500
  },
  isActive: {
    type: Boolean,
    default: true
  },
  settings: {
    currency: {
      type: String,
      default: 'USD',
      enum: ['USD', 'EUR', 'GBP', 'MXN', 'COP', 'PEN', 'ARS']
    },
    taxRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 1
    },
    serviceCharge: {
      type: Number,
      default: 0,
      min: 0,
      max: 1
    },
    autoPrintOrders: {
      type: Boolean,
      default: false
    },
    allowOnlineOrders: {
      type: Boolean,
      default: true
    }
  },
  subscription: {
    plan: {
      type: String,
      enum: ['starter', 'pro', 'business', 'enterprise'],
      default: 'starter'
    },
    status: {
      type: String,
      enum: ['active', 'cancelled', 'past_due'],
      default: 'active'
    },
    nextBillingDate: Date,
    features: [String]
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Indexes
restaurantSchema.index({ owner: 1 });
restaurantSchema.index({ name: 1 });
restaurantSchema.index({ 'subscription.status': 1 });

module.exports = mongoose.model('Restaurant', restaurantSchema);

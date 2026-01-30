const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  businessName: {
    type: String,
    trim: true
  },
  taxId: {
    type: String,
    trim: true
  },
  contactPerson: {
    type: String,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  address: {
    street: {
      type: String,
      trim: true
    },
    city: {
      type: String,
      trim: true
    },
    state: {
      type: String,
      trim: true
    },
    zipCode: {
      type: String,
      trim: true
    },
    country: {
      type: String,
      trim: true,
      default: 'MÉXICO'
    }
  },
  paymentTerms: {
    type: String,
    enum: ['contado', '15_dias', '30_dias', '45_dias', '60_dias'],
    default: 'contado'
  },
  deliveryDays: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  rating: {
    type: Number,
    min: 1,
    max: 5,
    default: 3
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
supplierSchema.index({ restaurantId: 1, name: 1 }, { unique: true });
supplierSchema.index({ restaurantId: 1, isActive: 1 });
supplierSchema.index({ restaurantId: 1, rating: -1 });

// Virtual for full address
supplierSchema.virtual('fullAddress').get(function() {
  const parts = [
    this.address.street,
    this.address.city,
    this.address.state,
    this.address.zipCode
  ].filter(Boolean);
  return parts.join(', ');
});

module.exports = mongoose.model('Supplier', supplierSchema);

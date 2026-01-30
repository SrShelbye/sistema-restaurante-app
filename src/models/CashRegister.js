const mongoose = require('mongoose');

const cashTransactionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['opening', 'sale', 'expense', 'closing'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  description: {
    type: String,
    trim: true
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'transfer', 'mixed'],
    default: 'cash'
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const cashRegisterSchema = new mongoose.Schema({
  registerNumber: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  openingAmount: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  closingAmount: {
    type: Number,
    min: 0
  },
  totalSales: {
    type: Number,
    min: 0,
    default: 0
  },
  totalExpenses: {
    type: Number,
    min: 0,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'closed'],
    default: 'active'
  },
  transactions: [cashTransactionSchema],
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  },
  openedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  closedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes
cashRegisterSchema.index({ restaurantId: 1, date: -1 });
cashRegisterSchema.index({ restaurantId: 1, status: 1 });

module.exports = mongoose.model('CashRegister', cashRegisterSchema);

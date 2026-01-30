const mongoose = require('mongoose');

const purchaseItemSchema = new mongoose.Schema({
  ingredientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ingredient',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  unit: {
    type: String,
    required: true,
    enum: ['kg', 'g', 'l', 'ml', 'unidad', 'docena', 'litro', 'kilo']
  },
  unitCost: {
    type: Number,
    required: true,
    min: 0
  },
  totalCost: {
    type: Number,
    required: true,
    min: 0
  },
  batchNumber: {
    type: String,
    trim: true
  },
  expirationDate: {
    type: Date
  }
});

const purchaseSchema = new mongoose.Schema({
  purchaseNumber: {
    type: String,
    required: true,
    unique: true
  },
  supplierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: true
  },
  items: [purchaseItemSchema],
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  taxAmount: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  total: {
    type: Number,
    required: true,
    min: 0
  },
  purchaseDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  deliveryDate: {
    type: Date
  },
  status: {
    type: String,
    enum: ['pending', 'received', 'partial', 'cancelled'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'partial'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'transfer', 'card', 'credit'],
    default: 'cash'
  },
  invoiceNumber: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Indexes
purchaseSchema.index({ restaurantId: 1, purchaseNumber: 1 }, { unique: true });
purchaseSchema.index({ restaurantId: 1, supplierId: 1 });
purchaseSchema.index({ restaurantId: 1, purchaseDate: -1 });
purchaseSchema.index({ restaurantId: 1, status: 1 });

// Pre-save middleware to generate purchase number
purchaseSchema.pre('save', async function(next) {
  if (this.isNew && !this.purchaseNumber) {
    const year = new Date().getFullYear();
    const count = await this.constructor.countDocuments({
      restaurantId: this.restaurantId,
      purchaseDate: {
        $gte: new Date(year, 0, 1),
        $lt: new Date(year + 1, 0, 1)
      }
    });
    this.purchaseNumber = `COMP-${year}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

// Method to update stock when purchase is received
purchaseSchema.methods.updateStock = async function() {
  const Ingredient = mongoose.model('Ingredient');
  
  for (const item of this.items) {
    await Ingredient.findByIdAndUpdate(
      item.ingredientId,
      {
        $inc: { currentStock: item.quantity },
        lastPurchaseDate: this.purchaseDate,
        unitCost: item.unitCost // Update unit cost to latest purchase price
      }
    );
  }
  
  this.status = 'received';
  return this.save();
};

module.exports = mongoose.model('Purchase', purchaseSchema);

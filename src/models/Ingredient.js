const mongoose = require('mongoose');

const ingredientSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  unit: {
    type: String,
    required: true,
    enum: ['kg', 'g', 'l', 'ml', 'unidad', 'docena', 'litro', 'kilo'],
    default: 'unidad'
  },
  currentStock: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  minStock: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  unitCost: {
    type: Number,
    required: true,
    min: 0
  },
  lastPurchaseDate: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  },
  supplierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier'
  },
  category: {
    type: String,
    enum: ['carnes', 'lacteos', 'granos', 'verduras', 'frutas', 'condimentos', 'bebidas', 'empaquetados', 'otros'],
    default: 'otros'
  }
}, {
  timestamps: true
});

// Indexes for performance
ingredientSchema.index({ restaurantId: 1, name: 1 }, { unique: true });
ingredientSchema.index({ restaurantId: 1, category: 1 });
ingredientSchema.index({ restaurantId: 1, currentStock: 1 });

// Virtual for stock status
ingredientSchema.virtual('stockStatus').get(function() {
  if (this.currentStock <= 0) return 'SIN STOCK';
  if (this.currentStock <= this.minStock) return 'STOCK BAJO';
  return 'OK';
});

// Method to update stock
ingredientSchema.methods.updateStock = function(quantity, operation = 'add') {
  if (operation === 'add') {
    this.currentStock += quantity;
  } else if (operation === 'subtract') {
    this.currentStock = Math.max(0, this.currentStock - quantity);
  }
  return this.save();
};

module.exports = mongoose.model('Ingredient', ingredientSchema);

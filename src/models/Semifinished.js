const mongoose = require('mongoose');

const semifinishedIngredientSchema = new mongoose.Schema({
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
  }
});

const semifinishedSchema = new mongoose.Schema({
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
  instructions: {
    type: String,
    trim: true
  },
  preparationTime: {
    type: Number, // in minutes
    min: 0
  },
  yieldQuantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  yieldUnit: {
    type: String,
    required: true,
    enum: ['kg', 'g', 'l', 'ml', 'unidad', 'docena', 'litro', 'kilo'],
    default: 'unidad'
  },
  ingredients: [semifinishedIngredientSchema],
  calculatedCost: {
    type: Number,
    min: 0,
    default: 0
  },
  unitCost: {
    type: Number,
    min: 0
  },
  category: {
    type: String,
    enum: ['salsas', 'masas', 'rellenos', 'bases', 'aderezos', 'marinadas', 'otros'],
    default: 'otros'
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
  lastCostCalculation: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes
semifinishedSchema.index({ restaurantId: 1, name: 1 }, { unique: true });
semifinishedSchema.index({ restaurantId: 1, category: 1 });
semifinishedSchema.index({ restaurantId: 1, isActive: 1 });

// Virtual for unit cost calculation
semifinishedSchema.virtual('calculatedUnitCost').get(function() {
  if (this.yieldQuantity === 0) return 0;
  return this.calculatedCost / this.yieldQuantity;
});

// Pre-save middleware to calculate cost
semifinishedSchema.pre('save', async function(next) {
  if (this.isModified('ingredients')) {
    await this.calculateCost();
  }
  next();
});

// Method to calculate semifinished cost
semifinishedSchema.methods.calculateCost = async function() {
  const Ingredient = mongoose.model('Ingredient');
  
  let totalCost = 0;

  // Calculate cost from ingredients
  for (const item of this.ingredients) {
    const ingredient = await Ingredient.findById(item.ingredientId);
    if (ingredient) {
      const unitCost = ingredient.unitCost;
      totalCost += unitCost * item.quantity;
    }
  }

  this.calculatedCost = totalCost;
  this.unitCost = this.yieldQuantity > 0 ? totalCost / this.yieldQuantity : 0;
  this.lastCostCalculation = new Date();

  return this.save();
};

module.exports = mongoose.model('Semifinished', semifinishedSchema);

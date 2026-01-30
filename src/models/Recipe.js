const mongoose = require('mongoose');

const recipeIngredientSchema = new mongoose.Schema({
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

const recipeSemifinishedSchema = new mongoose.Schema({
  semifinishedId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Semifinished',
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

const recipeSchema = new mongoose.Schema({
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
  portions: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  ingredients: [recipeIngredientSchema],
  semifinishedItems: [recipeSemifinishedSchema],
  calculatedCost: {
    type: Number,
    min: 0,
    default: 0
  },
  sellingPrice: {
    type: Number,
    min: 0
  },
  profitMargin: {
    type: Number,
    min: 0,
    max: 100
  },
  category: {
    type: String,
    enum: ['entradas', 'platos_principales', 'postres', 'bebidas', 'salsas', 'guarniciones', 'otros'],
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
recipeSchema.index({ restaurantId: 1, name: 1 }, { unique: true });
recipeSchema.index({ restaurantId: 1, category: 1 });
recipeSchema.index({ restaurantId: 1, isActive: 1 });

// Virtual for profit calculation
recipeSchema.virtual('profit').get(function() {
  if (!this.sellingPrice) return 0;
  return this.sellingPrice - this.calculatedCost;
});

recipeSchema.virtual('profitPercentage').get(function() {
  if (!this.sellingPrice || this.sellingPrice === 0) return 0;
  return ((this.sellingPrice - this.calculatedCost) / this.sellingPrice) * 100;
});

// Pre-save middleware to calculate cost
recipeSchema.pre('save', async function(next) {
  if (this.isModified('ingredients') || this.isModified('semifinishedItems')) {
    await this.calculateCost();
  }
  next();
});

// Method to calculate recipe cost
recipeSchema.methods.calculateCost = async function() {
  const Ingredient = mongoose.model('Ingredient');
  const Semifinished = mongoose.model('Semifinished');
  
  let totalCost = 0;

  // Calculate cost from ingredients
  for (const item of this.ingredients) {
    const ingredient = await Ingredient.findById(item.ingredientId);
    if (ingredient) {
      // Convert units if needed (simplified - you might need a conversion table)
      const unitCost = ingredient.unitCost;
      totalCost += unitCost * item.quantity;
    }
  }

  // Calculate cost from semifinished items
  for (const item of this.semifinishedItems) {
    const semifinished = await Semifinished.findById(item.semifinishedId);
    if (semifinished) {
      totalCost += semifinished.calculatedCost * item.quantity;
    }
  }

  this.calculatedCost = totalCost;
  this.lastCostCalculation = new Date();
  
  // Update profit margin if selling price is set
  if (this.sellingPrice) {
    this.profitMargin = ((this.sellingPrice - totalCost) / this.sellingPrice) * 100;
  }

  return this.save();
};

module.exports = mongoose.model('Recipe', recipeSchema);

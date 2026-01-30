const mongoose = require('mongoose');

// Schema for recipe ingredients within a product
const recipeIngredientSchema = new mongoose.Schema({
  ingredientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ingredient',
    required: true
  },
  grossQuantity: {
    type: Number,
    required: true,
    min: 0
  },
  netQuantity: {
    type: Number,
    required: true,
    min: 0
  },
  wastePercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  }
}, { _id: false });

const productSchema = new mongoose.Schema({
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
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  recipe: [recipeIngredientSchema],
  
  // Cost and pricing
  basePrice: {
    type: Number,
    required: true,
    min: 0
  },
  totalCost: {
    type: Number,
    default: 0,
    min: 0
  },
  finalPrice: {
    type: Number,
    required: true,
    min: 0
  },
  marginPercentage: {
    type: Number,
    default: 30,
    min: 0,
    max: 100
  },
  
  // Production
  productionAreaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProductionArea',
    required: true
  },
  preparationTime: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Media
  imageUrl: {
    type: String
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  
  // Multi-tenancy
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  },
  
  // Metadata
  tags: [String],
  allergens: [String],
  nutritionalInfo: {
    calories: Number,
    protein: Number,
    carbs: Number,
    fat: Number,
    fiber: Number,
    sodium: Number
  }
}, {
  timestamps: true
});

// Indexes for performance
productSchema.index({ restaurantId: 1, name: 1 }, { unique: true });
productSchema.index({ restaurantId: 1, categoryId: 1 });
productSchema.index({ restaurantId: 1, isActive: 1 });
productSchema.index({ restaurantId: 1, productionAreaId: 1 });

// Virtuals
productSchema.virtual('profitMargin').get(function() {
  if (this.finalPrice > 0) {
    return ((this.finalPrice - this.totalCost) / this.finalPrice) * 100;
  }
  return 0;
});

productSchema.virtual('isInStock').get(function() {
  return this.isAvailable && this.isActive;
});

// Pre-save middleware to calculate costs
productSchema.pre('save', async function(next) {
  if (this.isModified('recipe') || this.isModified('basePrice') || this.isModified('marginPercentage')) {
    await this.calculateCosts();
  }
  next();
});

// Methods
productSchema.methods.calculateCosts = async function() {
  let totalCost = 0;
  
  if (this.recipe && this.recipe.length > 0) {
    for (const recipeItem of this.recipe) {
      const ingredient = await mongoose.model('Ingredient').findById(recipeItem.ingredientId);
      if (ingredient) {
        totalCost += ingredient.unitCost * recipeItem.grossQuantity;
      }
    }
  }
  
  this.totalCost = totalCost;
  
  // Calculate final price based on margin
  this.finalPrice = this.basePrice * (1 + this.marginPercentage / 100);
  
  return this.save();
};

productSchema.methods.updateCosts = async function() {
  return this.calculateCosts();
};

productSchema.methods.getIngredientDetails = async function() {
  const populatedRecipe = await this.populate({
    path: 'recipe.ingredientId',
    select: 'name unit unitCost currentStock'
  });
  
  return populatedRecipe.recipe.map(item => ({
    ingredient: item.ingredientId,
    grossQuantity: item.grossQuantity,
    netQuantity: item.netQuantity,
    wastePercentage: item.wastePercentage,
    cost: item.ingredientId?.unitCost * item.grossQuantity || 0,
    ingredientName: item.ingredientId?.name || 'N/A'
  }));
};

module.exports = mongoose.model('Product', productSchema);

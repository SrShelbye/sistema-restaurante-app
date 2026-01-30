const mongoose = require('mongoose');

const saleItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'productType',
    required: true
  },
  productType: {
    type: String,
    enum: ['Recipe', 'Product'],
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0
  },
  totalPrice: {
    type: Number,
    required: true,
    min: 0
  },
  discount: {
    type: Number,
    min: 0,
    default: 0
  },
  notes: {
    type: String,
    trim: true
  }
});

const saleSchema = new mongoose.Schema({
  saleNumber: {
    type: String,
    required: true,
    unique: true
  },
  items: [saleItemSchema],
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  discountAmount: {
    type: Number,
    min: 0,
    default: 0
  },
  taxAmount: {
    type: Number,
    min: 0,
    default: 0
  },
  total: {
    type: Number,
    required: true,
    min: 0
  },
  saleDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'transfer', 'credit', 'mixed'],
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'partial'],
    default: 'paid'
  },
  orderType: {
    type: String,
    enum: ['dine_in', 'takeout', 'delivery'],
    default: 'dine_in'
  },
  tableNumber: {
    type: String,
    trim: true
  },
  customerName: {
    type: String,
    trim: true
  },
  customerPhone: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled'],
    default: 'completed'
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
  },
  stockUpdated: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes
saleSchema.index({ restaurantId: 1, saleNumber: 1 }, { unique: true });
saleSchema.index({ restaurantId: 1, saleDate: -1 });
saleSchema.index({ restaurantId: 1, status: 1 });
saleSchema.index({ restaurantId: 1, createdBy: 1 });

// Pre-save middleware to generate sale number
saleSchema.pre('save', async function(next) {
  if (this.isNew && !this.saleNumber) {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const count = await this.constructor.countDocuments({
      restaurantId: this.restaurantId,
      saleDate: {
        $gte: new Date(date.setHours(0, 0, 0, 0)),
        $lt: new Date(date.setHours(23, 59, 59, 999))
      }
    });
    this.saleNumber = `VENTA-${dateStr}-${String(count + 1).padStart(3, '0')}`;
  }
  next();
});

// Method to update stock when sale is completed
saleSchema.methods.updateStock = async function() {
  if (this.stockUpdated) return this;
  
  const Ingredient = mongoose.model('Ingredient');
  const Product = mongoose.model('Product');
  const lowStockAlerts = [];
  
  for (const item of this.items) {
    if (item.productType === 'Product') {
      // Get product with recipe
      const product = await Product.findById(item.productId);
      if (product && product.recipe && product.recipe.length > 0) {
        // Subtract ingredients from stock based on product recipe
        for (const recipeItem of product.recipe) {
          const quantityNeeded = recipeItem.grossQuantity * item.quantity;
          
          // Get current ingredient for stock check
          const ingredient = await Ingredient.findById(recipeItem.ingredientId);
          if (ingredient) {
            const newStock = ingredient.currentStock - quantityNeeded;
            
            // Update stock
            await Ingredient.findByIdAndUpdate(
              recipeItem.ingredientId,
              { 
                $inc: { currentStock: -quantityNeeded },
                lastPurchaseDate: new Date()
              }
            );
            
            // Check for low stock alert
            if (newStock <= ingredient.minStock) {
              lowStockAlerts.push({
                ingredientId: recipeItem.ingredientId,
                ingredientName: ingredient.name,
                currentStock: newStock,
                minStock: ingredient.minStock,
                unit: ingredient.unit,
                alertType: newStock <= 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK'
              });
            }
          }
        }
      }
    } else if (item.productType === 'Recipe') {
      // Handle Recipe type if needed
      const Recipe = mongoose.model('Recipe');
      const recipe = await Recipe.findById(item.productId).populate('ingredients.ingredientId');
      if (recipe) {
        for (const recipeItem of recipe.ingredients) {
          const quantityNeeded = recipeItem.quantity * item.quantity;
          
          const ingredient = await Ingredient.findById(recipeItem.ingredientId._id);
          if (ingredient) {
            const newStock = ingredient.currentStock - quantityNeeded;
            
            await Ingredient.findByIdAndUpdate(
              recipeItem.ingredientId._id,
              { 
                $inc: { currentStock: -quantityNeeded },
                lastPurchaseDate: new Date()
              }
            );
            
            if (newStock <= ingredient.minStock) {
              lowStockAlerts.push({
                ingredientId: recipeItem.ingredientId._id,
                ingredientName: ingredient.name,
                currentStock: newStock,
                minStock: ingredient.minStock,
                unit: ingredient.unit,
                alertType: newStock <= 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK'
              });
            }
          }
        }
      }
    }
  }
  
  this.stockUpdated = true;
  this.lowStockAlerts = lowStockAlerts;
  
  return this.save();
};

// Static method to get daily sales summary
saleSchema.statics.getDailySummary = async function(restaurantId, date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  const summary = await this.aggregate([
    {
      $match: {
        restaurantId: mongoose.Types.ObjectId(restaurantId),
        saleDate: { $gte: startOfDay, $lte: endOfDay },
        status: 'completed'
      }
    },
    {
      $group: {
        _id: null,
        totalSales: { $sum: '$total' },
        totalDiscount: { $sum: '$discountAmount' },
        totalTax: { $sum: '$taxAmount' },
        saleCount: { $sum: 1 },
        avgTicket: { $avg: '$total' }
      }
    }
  ]);
  
  return summary[0] || {
    totalSales: 0,
    totalDiscount: 0,
    totalTax: 0,
    saleCount: 0,
    avgTicket: 0
  };
};

module.exports = mongoose.model('Sale', saleSchema);

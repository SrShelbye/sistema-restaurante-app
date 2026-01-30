const mongoose = require('mongoose');

const orderDetailSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
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
  notes: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'preparing', 'ready', 'delivered', 'cancelled'],
    default: 'pending'
  },
  productionAreaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProductionArea',
    required: true
  }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    required: true,
    unique: true
  },
  tableId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Table'
  },
  details: [orderDetailSchema],
  subtotal: {
    type: Number,
    required: true,
    min: 0
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
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled'],
    default: 'active'
  },
  orderType: {
    type: String,
    enum: ['dine_in', 'takeout', 'delivery'],
    default: 'dine_in'
  },
  customerName: {
    type: String,
    trim: true
  },
  customerPhone: {
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
  },
  productionArea: {
    type: String,
    enum: ['kitchen', 'bar', 'grill', 'salad'],
    default: 'kitchen'
  }
}, {
  timestamps: true
});

// Indexes
orderSchema.index({ restaurantId: 1, orderNumber: 1 }, { unique: true });
orderSchema.index({ restaurantId: 1, status: 1 });
orderSchema.index({ restaurantId: 1, tableId: 1 });
orderSchema.index({ restaurantId: 1, createdBy: 1 });

// Pre-save middleware to generate order number
orderSchema.pre('save', async function(next) {
  if (this.isNew && !this.orderNumber) {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const count = await this.constructor.countDocuments({
      restaurantId: this.restaurantId,
      createdAt: {
        $gte: new Date(date.setHours(0, 0, 0, 0)),
        $lt: new Date(date.setHours(23, 59, 59, 999))
      }
    });
    this.orderNumber = `ORD-${dateStr}-${String(count + 1).padStart(3, '0')}`;
  }
  next();
});

// Method to group order details by production area
orderSchema.methods.groupByProductionArea = async function() {
  const Product = mongoose.model('Product');
  const ProductionArea = mongoose.model('ProductionArea');
  
  const groupedDetails = {};
  
  for (const detail of this.details) {
    // Get product to find production area
    const product = await Product.findById(detail.productId).populate('productionAreaId');
    const productionAreaId = product?.productionAreaId?._id;
    
    if (!productionAreaId) continue;
    
    if (!groupedDetails[productionAreaId.toString()]) {
      groupedDetails[productionAreaId.toString()] = {
        productionAreaId,
        productionArea: product.productionAreaId,
        details: [],
        totalItems: 0,
        subtotal: 0
      };
    }
    
    groupedDetails[productionAreaId.toString()].details.push(detail);
    groupedDetails[productionAreaId.toString()].totalItems += detail.quantity;
    groupedDetails[productionAreaId.toString()].subtotal += detail.totalPrice;
  }
  
  // Populate production area details
  const productionAreaIds = Object.keys(groupedDetails);
  const productionAreas = await ProductionArea.find({
    _id: { $in: productionAreaIds }
  });
  
  const areaMap = productionAreas.reduce((acc, area) => {
    acc[area._id.toString()] = area;
    return acc;
  }, {});
  
  // Add production area details to grouped data
  Object.keys(groupedDetails).forEach(areaId => {
    groupedDetails[areaId].productionArea = areaMap[areaId];
  });
  
  return Object.values(groupedDetails);
};

// Method to get order items for a specific production area
orderSchema.methods.getItemsForProductionArea = async function(productionAreaId) {
  const Product = mongoose.model('Product');
  
  const items = [];
  
  for (const detail of this.details) {
    const product = await Product.findById(detail.productId);
    
    if (product && product.productionAreaId && product.productionAreaId.toString() === productionAreaId) {
      items.push({
        ...detail.toObject(),
        productName: product.name,
        productCategory: product.categoryId
      });
    }
  }
  
  return items;
};

module.exports = mongoose.model('Order', orderSchema);

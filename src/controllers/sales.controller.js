const Sale = require('../models/Sale');
const Recipe = require('../models/Recipe');

class SalesController {
  static async createSale(req, res) {
    try {
      const saleData = {
        ...req.body,
        restaurantId: req.user.restaurantId || req.body.restaurantId,
        createdBy: req.user.userId || req.body.createdBy
      };

      // Calculate totals
      let subtotal = 0;
      saleData.items = saleData.items.map(item => {
        const totalPrice = item.quantity * item.unitPrice;
        subtotal += totalPrice;
        return {
          ...item,
          totalPrice
        };
      });

      saleData.subtotal = subtotal;
      saleData.discountAmount = saleData.discountAmount || 0;
      saleData.taxAmount = saleData.taxAmount || 0;
      saleData.total = subtotal - saleData.discountAmount + saleData.taxAmount;

      const sale = new Sale(saleData);
      await sale.save();

      // Update stock automatically
      await sale.updateStock();

      await sale.populate([
        {
          path: 'items.productId',
          select: 'name category'
        },
        {
          path: 'createdBy',
          select: 'username firstName lastName'
        }
      ]);

      res.status(201).json({
        success: true,
        data: sale
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'Número de venta duplicado'
        });
      }
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async getSales(req, res) {
    try {
      const {
        page = 1,
        limit = 50,
        startDate,
        endDate,
        orderType,
        paymentMethod,
        status,
        search
      } = req.query;

      const restaurantId = req.user.restaurantId || req.query.restaurantId;
      const filter = { restaurantId };

      if (startDate || endDate) {
        filter.saleDate = {};
        if (startDate) filter.saleDate.$gte = new Date(startDate);
        if (endDate) filter.saleDate.$lte = new Date(endDate);
      }

      if (orderType) filter.orderType = orderType;
      if (paymentMethod) filter.paymentMethod = paymentMethod;
      if (status) filter.status = status;
      if (search) {
        filter.saleNumber = { $regex: search, $options: 'i' };
      }

      const sales = await Sale.find(filter)
        .populate('items.productId', 'name category')
        .populate('createdBy', 'username firstName lastName')
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .sort({ saleDate: -1 });

      const total = await Sale.countDocuments(filter);

      res.json({
        success: true,
        data: {
          sales,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async getSale(req, res) {
    try {
      const sale = await Sale.findOne({
        _id: req.params.id,
        restaurantId: req.user.restaurantId
      })
        .populate('items.productId', 'name category ingredients')
        .populate('createdBy', 'username firstName lastName');

      if (!sale) {
        return res.status(404).json({
          success: false,
          message: 'Venta no encontrada'
        });
      }

      res.json({
        success: true,
        data: sale
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async updateSale(req, res) {
    try {
      const sale = await Sale.findOneAndUpdate(
        {
          _id: req.params.id,
          restaurantId: req.user.restaurantId
        },
        req.body,
        { new: true, runValidators: true }
      )
        .populate('items.productId', 'name category')
        .populate('createdBy', 'username firstName lastName');

      if (!sale) {
        return res.status(404).json({
          success: false,
          message: 'Venta no encontrada'
        });
      }

      res.json({
        success: true,
        data: sale
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async cancelSale(req, res) {
    try {
      const sale = await Sale.findOne({
        _id: req.params.id,
        restaurantId: req.user.restaurantId
      });

      if (!sale) {
        return res.status(404).json({
          success: false,
          message: 'Venta no encontrada'
        });
      }

      if (sale.status === 'cancelled') {
        return res.status(400).json({
          success: false,
          message: 'La venta ya está cancelada'
        });
      }

      // Return stock to inventory
      if (sale.stockUpdated) {
        const Ingredient = require('../models/Ingredient');
        
        for (const item of sale.items) {
          if (item.productType === 'Recipe') {
            const recipe = await Recipe.findById(item.productId).populate('ingredients.ingredientId');
            if (recipe) {
              for (const recipeItem of recipe.ingredients) {
                const quantityToReturn = recipeItem.quantity * item.quantity;
                await Ingredient.findByIdAndUpdate(
                  recipeItem.ingredientId._id,
                  { $inc: { currentStock: quantityToReturn } }
                );
              }
            }
          }
        }
      }

      sale.status = 'cancelled';
      await sale.save();

      res.json({
        success: true,
        message: 'Venta cancelada y stock devuelto correctamente'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async getDailySales(req, res) {
    try {
      const restaurantId = req.user.restaurantId || req.query.restaurantId;
      const { date = new Date() } = req.query;

      const dailySummary = await Sale.getDailySummary(restaurantId, new Date(date));

      // Get sales by hour
      const salesByHour = await Sale.aggregate([
        {
          $match: {
            restaurantId: require('mongoose').Types.ObjectId(restaurantId),
            saleDate: {
              $gte: new Date(new Date(date).setHours(0, 0, 0, 0)),
              $lt: new Date(new Date(date).setHours(23, 59, 59, 999))
            },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: { $hour: '$saleDate' },
            totalSales: { $sum: '$total' },
            saleCount: { $sum: 1 }
          }
        },
        {
          $sort: { '_id': 1 }
        }
      ]);

      // Get top selling items
      const topItems = await Sale.aggregate([
        {
          $match: {
            restaurantId: require('mongoose').Types.ObjectId(restaurantId),
            saleDate: {
              $gte: new Date(new Date(date).setHours(0, 0, 0, 0)),
              $lt: new Date(new Date(date).setHours(23, 59, 59, 999))
            },
            status: 'completed'
          }
        },
        {
          $unwind: '$items'
        },
        {
          $group: {
            _id: '$items.productId',
            totalQuantity: { $sum: '$items.quantity' },
            totalRevenue: { $sum: '$items.totalPrice' }
          }
        },
        {
          $lookup: {
            from: 'recipes',
            localField: '_id',
            foreignField: '_id',
            as: 'product'
          }
        },
        {
          $unwind: '$product'
        },
        {
          $project: {
            productName: '$product.name',
            totalQuantity: 1,
            totalRevenue: 1
          }
        },
        {
          $sort: { totalRevenue: -1 },
          $limit: 10
        }
      ]);

      res.json({
        success: true,
        data: {
          dailySummary,
          salesByHour,
          topItems
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async getSalesReport(req, res) {
    try {
      const restaurantId = req.user.restaurantId || req.query.restaurantId;
      const { startDate, endDate, groupBy = 'day' } = req.query;

      const dateFilter = {};
      if (startDate) dateFilter.$gte = new Date(startDate);
      if (endDate) dateFilter.$lte = new Date(endDate);

      let groupFormat;
      switch (groupBy) {
        case 'hour':
          groupFormat = { $hour: '$saleDate' };
          break;
        case 'day':
          groupFormat = {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$saleDate'
            }
          };
          break;
        case 'month':
          groupFormat = {
            $dateToString: {
              format: '%Y-%m',
              date: '$saleDate'
            }
          };
          break;
        default:
          groupFormat = {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$saleDate'
            }
          };
      }

      const salesReport = await Sale.aggregate([
        {
          $match: {
            restaurantId: require('mongoose').Types.ObjectId(restaurantId),
            saleDate: dateFilter,
            status: 'completed'
          }
        },
        {
          $group: {
            _id: groupFormat,
            totalSales: { $sum: '$total' },
            totalDiscount: { $sum: '$discountAmount' },
            totalTax: { $sum: '$taxAmount' },
            saleCount: { $sum: 1 },
            avgTicket: { $avg: '$total' }
          }
        },
        {
          $sort: { '_id': 1 }
        }
      ]);

      // Payment method breakdown
      const paymentBreakdown = await Sale.aggregate([
        {
          $match: {
            restaurantId: require('mongoose').Types.ObjectId(restaurantId),
            saleDate: dateFilter,
            status: 'completed'
          }
        },
        {
          $group: {
            _id: '$paymentMethod',
            totalAmount: { $sum: '$total' },
            saleCount: { $sum: 1 }
          }
        }
      ]);

      // Order type breakdown
      const orderTypeBreakdown = await Sale.aggregate([
        {
          $match: {
            restaurantId: require('mongoose').Types.ObjectId(restaurantId),
            saleDate: dateFilter,
            status: 'completed'
          }
        },
        {
          $group: {
            _id: '$orderType',
            totalAmount: { $sum: '$total' },
            saleCount: { $sum: 1 }
          }
        }
      ]);

      res.json({
        success: true,
        data: {
          salesReport,
          paymentBreakdown,
          orderTypeBreakdown
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async closeCashRegister(req, res) {
    try {
      const restaurantId = req.user.restaurantId || req.query.restaurantId;
      const { date = new Date() } = req.query;

      const startOfDay = new Date(new Date(date).setHours(0, 0, 0, 0));
      const endOfDay = new Date(new Date(date).setHours(23, 59, 59, 999));

      const cashRegisterSummary = await Sale.aggregate([
        {
          $match: {
            restaurantId: require('mongoose').Types.ObjectId(restaurantId),
            saleDate: { $gte: startOfDay, $lte: endOfDay },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: '$paymentMethod',
            totalAmount: { $sum: '$total' },
            saleCount: { $sum: 1 }
          }
        }
      ]);

      const totalSummary = await Sale.aggregate([
        {
          $match: {
            restaurantId: require('mongoose').Types.ObjectId(restaurantId),
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
            saleCount: { $sum: 1 }
          }
        }
      ]);

      res.json({
        success: true,
        data: {
          date: date,
          cashRegisterSummary,
          totalSummary: totalSummary[0] || {
            totalSales: 0,
            totalDiscount: 0,
            totalTax: 0,
            saleCount: 0
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = SalesController;

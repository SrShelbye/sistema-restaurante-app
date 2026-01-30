const Ingredient = require('../models/Ingredient');
const Recipe = require('../models/Recipe');
const Sale = require('../models/Sale');
const Purchase = require('../models/Purchase');

class ReportsController {
  static async getInventoryValuation(req, res) {
    try {
      const restaurantId = req.user.restaurantId || req.query.restaurantId;
      
      const ingredients = await Ingredient.find({
        restaurantId,
        isActive: true
      });

      // ✅ Valor total del inventario (stockActual * costo)
      const valuation = {
        totalItems: ingredients.length,
        totalValue: ingredients.reduce((sum, item) => sum + (item.currentStock * item.unitCost), 0),
        categories: {},
        stockStatus: {
          outOfStock: 0,
          lowStock: 0,
          normal: 0
        },
        ingredients: ingredients.map(item => ({
          id: item._id,
          name: item.name,
          category: item.category,
          currentStock: item.currentStock,
          minStock: item.minStock,
          unit: item.unit,
          unitCost: item.unitCost,
          totalValue: item.currentStock * item.unitCost,
          status: item.stockStatus
        }))
      };

      // Group by category
      ingredients.forEach(item => {
        if (!valuation.categories[item.category]) {
          valuation.categories[item.category] = {
            count: 0,
            totalValue: 0
          };
        }
        valuation.categories[item.category].count++;
        valuation.categories[item.category].totalValue += item.currentStock * item.unitCost;
      });

      // Count stock status
      ingredients.forEach(item => {
        if (item.currentStock === 0) {
          valuation.stockStatus.outOfStock++;
        } else if (item.currentStock <= item.minStock) {
          valuation.stockStatus.lowStock++;
        } else {
          valuation.stockStatus.normal++;
        }
      });

      res.json({
        success: true,
        data: valuation,
        timestamp: new Date()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async getDailySalesReport(req, res) {
    try {
      const {
        startDate = new Date().toISOString().split('T')[0],
        endDate = new Date().toISOString().split('T')[0]
      } = req.query;

      const restaurantId = req.user.restaurantId;
      
      const startOfDay = new Date(startDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);

      const sales = await Sale.find({
        restaurantId,
        saleDate: { $gte: startOfDay, $lte: endOfDay },
        status: 'completed'
      })
        .populate('createdBy', 'username firstName lastName')
        .populate('tableId', 'number capacity location')
        .sort({ saleDate: -1 });

      // ✅ Reporte de ventas diarias que suma totales de pedidos pagados
      const report = {
        date: startDate,
        totalSales: sales.length,
        totalRevenue: sales.reduce((sum, sale) => sum + sale.total, 0),
        totalOrders: sales.length,
        paidOrders: sales.filter(sale => sale.paymentStatus === 'paid').length,
        pendingOrders: sales.filter(sale => sale.paymentStatus === 'pending').length,
        averageTicket: sales.length > 0 ? sales.reduce((sum, sale) => sum + sale.total, 0) / sales.length : 0,
        paymentMethods: {
          cash: sales.filter(sale => sale.paymentMethod === 'cash').reduce((sum, sale) => sum + sale.total, 0),
          card: sales.filter(sale => sale.paymentMethod === 'card').reduce((sum, sale) => sum + sale.total, 0),
          transfer: sales.filter(sale => sale.paymentMethod === 'transfer').reduce((sum, sale) => sum + sale.total, 0),
          credit: sales.filter(sale => sale.paymentMethod === 'credit').reduce((sum, sale) => sum + sale.total, 0),
          mixed: sales.filter(sale => sale.paymentMethod === 'mixed').reduce((sum, sale) => sum + sale.total, 0)
        },
        orderTypes: {
          dine_in: sales.filter(sale => sale.orderType === 'dine_in').length,
          takeout: sales.filter(sale => sale.orderType === 'takeout').length,
          delivery: sales.filter(sale => sale.orderType === 'delivery').length
        },
        sales: sales.map(sale => ({
          id: sale._id,
          saleNumber: sale.saleNumber,
          saleDate: sale.saleDate,
          total: sale.total,
          subtotal: sale.subtotal,
          discountAmount: sale.discountAmount,
          taxAmount: sale.taxAmount,
          paymentMethod: sale.paymentMethod,
          paymentStatus: sale.paymentStatus,
          orderType: sale.orderType,
          tableNumber: sale.tableId?.number || 'N/A',
          customerName: sale.customerName,
          itemsCount: sale.items.length,
          createdBy: sale.createdBy
        }))
      };

      res.json({
        success: true,
        data: report,
        timestamp: new Date()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async getFinancialSummary(req, res) {
    try {
      const {
        period = 'month',
        startDate,
        endDate
      } = req.query;

      const restaurantId = req.user.restaurantId;
      
      let dateFilter = {};
      if (startDate && endDate) {
        dateFilter = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      } else {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        dateFilter = { $gte: startOfMonth, $lte: endOfMonth };
      }

      const [sales, purchases, ingredients] = await Promise.all([
        Sale.find({
          restaurantId,
          saleDate: dateFilter,
          status: 'completed'
        }),
        Purchase.find({
          restaurantId,
          purchaseDate: dateFilter,
          status: 'completed'
        }),
        Ingredient.find({ restaurantId, isActive: true })
      ]);

      const totalRevenue = sales.reduce((sum, sale) => sum + sale.total, 0);
      const totalCost = purchases.reduce((sum, purchase) => sum + purchase.totalAmount, 0);
      const inventoryValue = ingredients.reduce((sum, item) => sum + (item.currentStock * item.unitCost), 0);
      
      const grossProfit = totalRevenue - totalCost;
      const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

      const summary = {
        period,
        dateRange: {
          startDate: dateFilter.$gte || new Date(startDate),
          endDate: dateFilter.$lte || new Date(endDate)
        },
        revenue: {
          total: totalRevenue,
          salesCount: sales.length,
          averageTicket: sales.length > 0 ? totalRevenue / sales.length : 0
        },
        costs: {
          total: totalCost,
          purchases: purchases.length,
          inventoryValue: inventoryValue
        },
        profitability: {
          grossProfit,
          profitMargin,
          netProfit: grossProfit // Simplified, would include other costs in real scenario
        },
        salesBreakdown: {
          byPaymentMethod: {
            cash: sales.filter(s => s.paymentMethod === 'cash').reduce((sum, s) => sum + s.total, 0),
            card: sales.filter(s => s.paymentMethod === 'card').reduce((sum, s) => sum + s.total, 0),
            transfer: sales.filter(s => s.paymentMethod === 'transfer').reduce((sum, s) => sum + s.total, 0)
          },
          byOrderType: {
            dine_in: sales.filter(s => s.orderType === 'dine_in').length,
            takeout: sales.filter(s => s.orderType === 'takeout').length,
            delivery: sales.filter(s => s.orderType === 'delivery').length
          }
        }
      };

      res.json({
        success: true,
        data: summary,
        timestamp: new Date()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
      ingredients.forEach(item => {
        if (item.currentStock <= 0) {
          valuation.stockStatus.outOfStock++;
        } else if (item.currentStock <= item.minStock) {
          valuation.stockStatus.lowStock++;
        } else {
          valuation.stockStatus.normal++;
        }
      });

      res.json({
        success: true,
        data: valuation
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async getCostAnalysis(req, res) {
    try {
      const restaurantId = req.user.restaurantId || req.query.restaurantId;
      
      const recipes = await Recipe.find({
        restaurantId,
        isActive: true
      })
        .populate('ingredients.ingredientId', 'name unit unitCost currentStock')
        .populate('semifinishedItems.semifinishedId', 'name unitCost');

      const analysis = {
        totalRecipes: recipes.length,
        avgCost: recipes.reduce((sum, r) => sum + r.calculatedCost, 0) / recipes.length,
        avgPrice: recipes.reduce((sum, r) => sum + (r.sellingPrice || 0), 0) / recipes.length,
        avgProfitMargin: recipes.reduce((sum, r) => sum + (r.profitMargin || 0), 0) / recipes.length,
        costDistribution: {
          lowCost: 0,    // < $50
          mediumCost: 0, // $50-$200
          highCost: 0    // > $200
        },
        profitDistribution: {
          lowProfit: 0,    // < 20%
          mediumProfit: 0, // 20%-50%
          highProfit: 0    // > 50%
        },
        recipes: recipes.map(r => ({
          id: r._id,
          name: r.name,
          category: r.category,
          calculatedCost: r.calculatedCost,
          sellingPrice: r.sellingPrice,
          profit: r.profit,
          profitMargin: r.profitMargin,
          profitPercentage: r.profitPercentage,
          ingredientCount: r.ingredients.length + r.semifinishedItems.length
        }))
      };

      // Calculate distributions
      recipes.forEach(r => {
        // Cost distribution
        if (r.calculatedCost < 50) analysis.costDistribution.lowCost++;
        else if (r.calculatedCost <= 200) analysis.costDistribution.mediumCost++;
        else analysis.costDistribution.highCost++;

        // Profit distribution
        if (r.profitPercentage < 20) analysis.profitDistribution.lowProfit++;
        else if (r.profitPercentage <= 50) analysis.profitDistribution.mediumProfit++;
        else analysis.profitDistribution.highProfit++;
      });

      res.json({
        success: true,
        data: analysis
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async getSalesPerformance(req, res) {
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

      const performance = await Sale.aggregate([
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
            totalRevenue: { $sum: '$total' },
            totalSales: { $sum: 1 },
            avgTicket: { $avg: '$total' },
            totalDiscount: { $sum: '$discountAmount' }
          }
        },
        {
          $sort: { '_id': 1 }
        }
      ]);

      // Top selling products
      const topProducts = await Sale.aggregate([
        {
          $match: {
            restaurantId: require('mongoose').Types.ObjectId(restaurantId),
            saleDate: dateFilter,
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
            category: '$product.category',
            totalQuantity: 1,
            totalRevenue: 1
          }
        },
        {
          $sort: { totalRevenue: -1 },
          $limit: 20
        }
      ]);

      res.json({
        success: true,
        data: {
          performance,
          topProducts
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async getProfitabilityReport(req, res) {
    try {
      const restaurantId = req.user.restaurantId || req.query.restaurantId;
      const { startDate, endDate } = req.query;

      const dateFilter = {};
      if (startDate) dateFilter.$gte = new Date(startDate);
      if (endDate) dateFilter.$lte = new Date(endDate);

      // Get sales revenue
      const salesData = await Sale.aggregate([
        {
          $match: {
            restaurantId: require('mongoose').Types.ObjectId(restaurantId),
            saleDate: dateFilter,
            status: 'completed'
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$total' },
            totalSales: { $sum: 1 }
          }
        }
      ]);

      // Get cost of goods sold (COGS)
      const cogsData = await Sale.aggregate([
        {
          $match: {
            restaurantId: require('mongoose').Types.ObjectId(restaurantId),
            saleDate: dateFilter,
            status: 'completed'
          }
        },
        {
          $unwind: '$items'
        },
        {
          $match: {
            'items.productType': 'Recipe'
          }
        },
        {
          $lookup: {
            from: 'recipes',
            localField: 'items.productId',
            foreignField: '_id',
            as: 'recipe'
          }
        },
        {
          $unwind: '$recipe'
        },
        {
          $group: {
            _id: null,
            totalCOGS: {
              $sum: { $multiply: ['$recipe.calculatedCost', '$items.quantity'] }
            }
          }
        }
      ]);

      // Get purchase costs
      const purchaseData = await Purchase.aggregate([
        {
          $match: {
            restaurantId: require('mongoose').Types.ObjectId(restaurantId),
            purchaseDate: dateFilter,
            status: 'received'
          }
        },
        {
          $group: {
            _id: null,
            totalPurchases: { $sum: '$total' }
          }
        }
      ]);

      const totalRevenue = salesData[0]?.totalRevenue || 0;
      const totalCOGS = cogsData[0]?.totalCOGS || 0;
      const totalPurchases = purchaseData[0]?.totalPurchases || 0;

      const grossProfit = totalRevenue - totalCOGS;
      const grossProfitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

      const profitability = {
        period: { startDate, endDate },
        revenue: {
          total: totalRevenue,
          salesCount: salesData[0]?.totalSales || 0
        },
        costs: {
          cogs: totalCOGS,
          purchases: totalPurchases
        },
        profitability: {
          grossProfit,
          grossProfitMargin,
          netProfit: grossProfit - totalPurchases,
          netProfitMargin: totalRevenue > 0 ? ((grossProfit - totalPurchases) / totalRevenue) * 100 : 0
        }
      };

      res.json({
        success: true,
        data: profitability
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async getIngredientUsage(req, res) {
    try {
      const restaurantId = req.user.restaurantId || req.query.restaurantId;
      const { startDate, endDate, ingredientId } = req.query;

      const dateFilter = {};
      if (startDate) dateFilter.$gte = new Date(startDate);
      if (endDate) dateFilter.$lte = new Date(endDate);

      const matchFilter = {
        restaurantId: require('mongoose').Types.ObjectId(restaurantId),
        saleDate: dateFilter,
        status: 'completed'
      };

      const usage = await Sale.aggregate([
        {
          $match: matchFilter
        },
        {
          $unwind: '$items'
        },
        {
          $match: {
            'items.productType': 'Recipe'
          }
        },
        {
          $lookup: {
            from: 'recipes',
            localField: 'items.productId',
            foreignField: '_id',
            as: 'recipe'
          }
        },
        {
          $unwind: '$recipe'
        },
        {
          $unwind: '$recipe.ingredients'
        },
        {
          $match: ingredientId ? 
            { 'recipe.ingredients.ingredientId': require('mongoose').Types.ObjectId(ingredientId) } :
            {}
        },
        {
          $group: {
            _id: '$recipe.ingredients.ingredientId',
            ingredientName: { $first: '$recipe.ingredients.ingredientId' },
            totalQuantityUsed: { 
              $sum: { $multiply: ['$recipe.ingredients.quantity', '$items.quantity'] }
            },
            usageCount: { $sum: 1 },
            recipesUsedIn: { $addToSet: '$recipe.name' }
          }
        },
        {
          $lookup: {
            from: 'ingredients',
            localField: '_id',
            foreignField: '_id',
            as: 'ingredient'
          }
        },
        {
          $unwind: '$ingredient'
        },
        {
          $project: {
            ingredientName: '$ingredient.name',
            unit: '$ingredient.unit',
            unitCost: '$ingredient.unitCost',
            totalQuantityUsed: 1,
            usageCount: 1,
            totalCost: { $multiply: ['$ingredient.unitCost', '$totalQuantityUsed'] },
            recipesUsedIn: 1
          }
        },
        {
          $sort: { totalCost: -1 }
        }
      ]);

      res.json({
        success: true,
        data: usage
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async getDashboardMetrics(req, res) {
    try {
      const restaurantId = req.user.restaurantId || req.query.restaurantId;
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0));
      const endOfDay = new Date(today.setHours(23, 59, 59, 999));
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const startOfYear = new Date(today.getFullYear(), 0, 1);

      // Today's sales
      const todaySales = await Sale.aggregate([
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
            totalRevenue: { $sum: '$total' },
            salesCount: { $sum: 1 }
          }
        }
      ]);

      // Month's sales
      const monthSales = await Sale.aggregate([
        {
          $match: {
            restaurantId: require('mongoose').Types.ObjectId(restaurantId),
            saleDate: { $gte: startOfMonth, $lte: endOfDay },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$total' },
            salesCount: { $sum: 1 }
          }
        }
      ]);

      // Year's sales
      const yearSales = await Sale.aggregate([
        {
          $match: {
            restaurantId: require('mongoose').Types.ObjectId(restaurantId),
            saleDate: { $gte: startOfYear, $lte: endOfDay },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$total' },
            salesCount: { $sum: 1 }
          }
        }
      ]);

      // Inventory status
      const inventoryStatus = await Ingredient.aggregate([
        {
          $match: {
            restaurantId: require('mongoose').Types.ObjectId(restaurantId),
            isActive: true
          }
        },
        {
          $group: {
            _id: null,
            totalItems: { $sum: 1 },
            outOfStock: {
              $sum: { $cond: [{ $lte: ['$currentStock', 0] }, 1, 0] }
            },
            lowStock: {
              $sum: { 
                $cond: [
                  { $and: [{ $gt: ['$currentStock', 0] }, { $lte: ['$currentStock', '$minStock'] }] },
                  1,
                  0
                ]
              }
            }
          }
        }
      ]);

      // Recipe cost analysis
      const recipeAnalysis = await Recipe.aggregate([
        {
          $match: {
            restaurantId: require('mongoose').Types.ObjectId(restaurantId),
            isActive: true
          }
        },
        {
          $group: {
            _id: null,
            totalRecipes: { $sum: 1 },
            avgCost: { $avg: '$calculatedCost' },
            avgProfitMargin: { $avg: '$profitMargin' }
          }
        }
      ]);

      const metrics = {
        sales: {
          today: {
            revenue: todaySales[0]?.totalRevenue || 0,
            count: todaySales[0]?.salesCount || 0
          },
          month: {
            revenue: monthSales[0]?.totalRevenue || 0,
            count: monthSales[0]?.salesCount || 0
          },
          year: {
            revenue: yearSales[0]?.totalRevenue || 0,
            count: yearSales[0]?.salesCount || 0
          }
        },
        inventory: {
          totalItems: inventoryStatus[0]?.totalItems || 0,
          outOfStock: inventoryStatus[0]?.outOfStock || 0,
          lowStock: inventoryStatus[0]?.lowStock || 0,
          healthyItems: (inventoryStatus[0]?.totalItems || 0) - 
                       ((inventoryStatus[0]?.outOfStock || 0) + (inventoryStatus[0]?.lowStock || 0))
        },
        recipes: {
          total: recipeAnalysis[0]?.totalRecipes || 0,
          avgCost: recipeAnalysis[0]?.avgCost || 0,
          avgProfitMargin: recipeAnalysis[0]?.avgProfitMargin || 0
        }
      };

      res.json({
        success: true,
        data: metrics
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = ReportsController;

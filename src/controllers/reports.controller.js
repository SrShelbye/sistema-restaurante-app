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
}

module.exports = {
  getInventoryValuation: ReportsController.getInventoryValuation,
  getDailySalesReport: ReportsController.getDailySalesReport,
  getFinancialSummary: ReportsController.getFinancialSummary
};

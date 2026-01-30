const Ingredient = require('../models/Ingredient');

class StockAlertController {
  static async getLowStockAlerts(req, res) {
    try {
      const restaurantId = req.user.restaurantId;
      
      // Find ingredients with low stock
      const lowStockIngredients = await Ingredient.find({
        restaurantId,
        isActive: true,
        $expr: {
          $lte: ['$currentStock', '$minStock']
        }
      })
      .select('name currentStock minStock unit lastPurchaseDate')
      .sort({ currentStock: 1 });

      // Categorize alerts
      const alerts = lowStockIngredients.map(ingredient => ({
        ingredientId: ingredient._id,
        ingredientName: ingredient.name,
        currentStock: ingredient.currentStock,
        minStock: ingredient.minStock,
        unit: ingredient.unit,
        alertType: ingredient.currentStock <= 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK',
        lastPurchaseDate: ingredient.lastPurchaseDate,
        shortage: Math.max(0, ingredient.minStock - ingredient.currentStock)
      }));

      // Summary statistics
      const summary = {
        totalAlerts: alerts.length,
        outOfStock: alerts.filter(a => a.alertType === 'OUT_OF_STOCK').length,
        lowStock: alerts.filter(a => a.alertType === 'LOW_STOCK').length,
        criticalItems: alerts.filter(a => a.currentStock === 0).map(a => a.ingredientName)
      };

      res.json({
        success: true,
        data: {
          alerts,
          summary,
          timestamp: new Date()
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async getStockAlertsHistory(req, res) {
    try {
      const { startDate, endDate, limit = 50 } = req.query;
      const restaurantId = req.user.restaurantId;

      // Get sales with stock alerts in the specified period
      const Sale = require('../models/Sale');
      const start = new Date(startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
      const end = new Date(endDate || new Date());

      const salesWithAlerts = await Sale.find({
        restaurantId,
        saleDate: { $gte: start, $lte: end },
        lowStockAlerts: { $exists: true, $ne: [] }
      })
      .select('saleNumber saleDate lowStockAlerts')
      .sort({ saleDate: -1 })
      .limit(parseInt(limit));

      const history = salesWithAlerts.map(sale => ({
        saleNumber: sale.saleNumber,
        saleDate: sale.saleDate,
        alerts: sale.lowStockAlerts,
        totalAlerts: sale.lowStockAlerts.length
      }));

      res.json({
        success: true,
        data: {
          history,
          summary: {
            totalSalesWithAlerts: history.length,
            totalAlerts: history.reduce((sum, sale) => sum + sale.totalAlerts, 0)
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

  static async createStockAlert(req, res) {
    try {
      const { ingredientId, alertType, message } = req.body;
      const restaurantId = req.user.restaurantId;

      const ingredient = await Ingredient.findOne({
        _id: ingredientId,
        restaurantId
      });

      if (!ingredient) {
        return res.status(404).json({
          success: false,
          message: 'Ingrediente no encontrado'
        });
      }

      const alert = {
        ingredientId: ingredient._id,
        ingredientName: ingredient.name,
        currentStock: ingredient.currentStock,
        minStock: ingredient.minStock,
        unit: ingredient.unit,
        alertType: alertType || 'MANUAL',
        message: message || 'Alerta manual de stock',
        timestamp: new Date()
      };

      // Emit socket event for real-time dashboard update
      const io = req.app.get('io');
      if (io) {
        io.to(`restaurant_${restaurantId}`).emit('stockAlert', alert);
      }

      res.status(201).json({
        success: true,
        data: alert
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async getStockAnalysis(req, res) {
    try {
      const restaurantId = req.user.restaurantId;

      const ingredients = await Ingredient.find({ restaurantId, isActive: true })
        .select('name currentStock minStock unit unitCost category');

      const analysis = {
        totalIngredients: ingredients.length,
        inStock: ingredients.filter(i => i.currentStock > i.minStock).length,
        lowStock: ingredients.filter(i => i.currentStock > 0 && i.currentStock <= i.minStock).length,
        outOfStock: ingredients.filter(i => i.currentStock === 0).length,
        totalValue: ingredients.reduce((sum, i) => sum + (i.currentStock * i.unitCost), 0),
        categoryBreakdown: {}
      };

      // Category breakdown
      ingredients.forEach(ingredient => {
        const category = ingredient.category || 'otros';
        if (!analysis.categoryBreakdown[category]) {
          analysis.categoryBreakdown[category] = {
            count: 0,
            totalValue: 0,
            lowStockCount: 0
          };
        }
        analysis.categoryBreakdown[category].count++;
        analysis.categoryBreakdown[category].totalValue += ingredient.currentStock * ingredient.unitCost;
        if (ingredient.currentStock <= ingredient.minStock) {
          analysis.categoryBreakdown[category].lowStockCount++;
        }
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
}

module.exports = StockAlertController;

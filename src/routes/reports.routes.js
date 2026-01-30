const express = require('express');
const ReportsController = require('../controllers/reports.controller');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

// Inventory reports
router.get('/reports/inventory-valuation', 
  authenticateToken, 
  ReportsController.getInventoryValuation
);

router.get('/reports/ingredient-usage', 
  authenticateToken, 
  ReportsController.getIngredientUsage
);

// Cost analysis reports
router.get('/reports/cost-analysis', 
  authenticateToken, 
  ReportsController.getCostAnalysis
);

router.get('/reports/profitability', 
  authenticateToken, 
  ReportsController.getProfitabilityReport
);

// Sales performance reports
router.get('/reports/sales-performance', 
  authenticateToken, 
  ReportsController.getSalesPerformance
);

// ✅ Financial reports
router.get('/reports/daily-sales', 
  authenticateToken, 
  ReportsController.getDailySalesReport
);

router.get('/reports/financial-summary', 
  authenticateToken, 
  ReportsController.getFinancialSummary
);

// Dashboard metrics
router.get('/reports/dashboard', 
  authenticateToken, 
  ReportsController.getDashboardMetrics
);

module.exports = router;

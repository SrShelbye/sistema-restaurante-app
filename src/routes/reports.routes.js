const express = require('express');
const ReportsController = require('../controllers/reports.controller');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

// Inventory reports
router.get('/reports/inventory-valuation', 
  authenticateToken, 
  ReportsController.getInventoryValuation
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

module.exports = router;

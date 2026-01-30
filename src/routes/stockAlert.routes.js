const express = require('express');
const StockAlertController = require('../controllers/stockAlert.controller');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

// Stock alert routes
router.get('/alerts/low-stock', 
  authenticateToken, 
  StockAlertController.getLowStockAlerts
);

router.get('/alerts/history', 
  authenticateToken, 
  StockAlertController.getStockAlertsHistory
);

router.post('/alerts', 
  authenticateToken, 
  requireRole(['admin']), 
  StockAlertController.createStockAlert
);

router.get('/analysis', 
  authenticateToken, 
  StockAlertController.getStockAnalysis
);

module.exports = router;

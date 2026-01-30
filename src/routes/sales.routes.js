const express = require('express');
const SalesController = require('../controllers/sales.controller');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

// Sale CRUD routes
router.post('/sales', 
  authenticateToken, 
  SalesController.createSale
);

router.get('/sales', 
  authenticateToken, 
  SalesController.getSales
);

router.get('/sales/:id', 
  authenticateToken, 
  SalesController.getSale
);

router.put('/sales/:id', 
  authenticateToken, 
  requireRole(['admin']), 
  SalesController.updateSale
);

router.delete('/sales/:id', 
  authenticateToken, 
  requireRole(['admin']), 
  SalesController.cancelSale
);

// Sales reports and analytics
router.get('/sales/daily', 
  authenticateToken, 
  SalesController.getDailySales
);

router.get('/sales/report', 
  authenticateToken, 
  SalesController.getSalesReport
);

router.get('/sales/close-cash-register', 
  authenticateToken, 
  SalesController.closeCashRegister
);

module.exports = router;

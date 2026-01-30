const express = require('express');
const CashController = require('../controllers/cash.controller');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

// Cash Register routes
router.post('/open', 
  authenticateToken, 
  CashController.openCashRegister
);

router.get('/actives', 
  authenticateToken, 
  CashController.getActiveCashRegisters
);

router.post('/:id/close', 
  authenticateToken, 
  requireRole(['admin']), 
  CashController.closeCashRegister
);

router.post('/:id/transaction', 
  authenticateToken, 
  CashController.addTransaction
);

router.get('/history', 
  authenticateToken, 
  CashController.getCashRegisterHistory
);

router.get('/summary', 
  authenticateToken, 
  CashController.getCashRegisterSummary
);

module.exports = router;

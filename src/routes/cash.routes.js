const express = require('express');
const CashController = require('../controllers/cash.controller');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

// Cash Register routes
router.post('/cash-register/open', 
  authenticateToken, 
  CashController.openCashRegister
);

router.get('/cash-register/actives', 
  authenticateToken, 
  CashController.getActiveCashRegisters
);

router.post('/cash-register/:id/close', 
  authenticateToken, 
  requireRole(['admin']), 
  CashController.closeCashRegister
);

router.post('/cash-register/:id/transaction', 
  authenticateToken, 
  CashController.addTransaction
);

router.get('/cash-register/history', 
  authenticateToken, 
  CashController.getCashRegisterHistory
);

router.get('/cash-register/summary', 
  authenticateToken, 
  CashController.getCashRegisterSummary
);

module.exports = router;

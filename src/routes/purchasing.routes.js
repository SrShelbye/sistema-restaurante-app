const express = require('express');
const PurchasingController = require('../controllers/purchasing.controller');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

// Supplier routes
router.post('/suppliers', 
  authenticateToken, 
  requireRole(['admin']), 
  PurchasingController.createSupplier
);

router.get('/suppliers', 
  authenticateToken, 
  PurchasingController.getSuppliers
);

router.get('/suppliers/:id', 
  authenticateToken, 
  PurchasingController.getSupplier
);

router.put('/suppliers/:id', 
  authenticateToken, 
  requireRole(['admin']), 
  PurchasingController.updateSupplier
);

router.delete('/suppliers/:id', 
  authenticateToken, 
  requireRole(['admin']), 
  PurchasingController.deleteSupplier
);

// Purchase routes
router.post('/purchases', 
  authenticateToken, 
  requireRole(['admin']), 
  PurchasingController.createPurchase
);

router.get('/purchases', 
  authenticateToken, 
  PurchasingController.getPurchases
);

router.get('/purchases/:id', 
  authenticateToken, 
  PurchasingController.getPurchase
);

router.put('/purchases/:id', 
  authenticateToken, 
  requireRole(['admin']), 
  PurchasingController.updatePurchase
);

router.post('/purchases/:id/receive', 
  authenticateToken, 
  requireRole(['admin']), 
  PurchasingController.receivePurchase
);

// Purchase reports
router.get('/purchases/summary', 
  authenticateToken, 
  PurchasingController.getPurchaseSummary
);

module.exports = router;

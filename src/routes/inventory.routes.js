const express = require('express');
const InventoryController = require('../controllers/inventory.controller');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

// Ingredient routes
router.post('/ingredients', 
  authenticateToken, 
  requireRole(['admin']), 
  InventoryController.createIngredient
);

router.get('/ingredients', 
  authenticateToken, 
  InventoryController.getIngredients
);

router.get('/ingredients/:id', 
  authenticateToken, 
  InventoryController.getIngredient
);

router.put('/ingredients/:id', 
  authenticateToken, 
  requireRole(['admin']), 
  InventoryController.updateIngredient
);

router.delete('/ingredients/:id', 
  authenticateToken, 
  requireRole(['admin']), 
  InventoryController.deleteIngredient
);

router.patch('/ingredients/:id/stock', 
  authenticateToken, 
  requireRole(['admin']), 
  InventoryController.updateStock
);

// Semifinished routes
router.post('/semifinished', 
  authenticateToken, 
  requireRole(['admin']), 
  InventoryController.createSemifinished
);

router.get('/semifinished', 
  authenticateToken, 
  InventoryController.getSemifinished
);

// Stock reports
router.get('/stock/report', 
  authenticateToken, 
  InventoryController.getStockReport
);

module.exports = router;

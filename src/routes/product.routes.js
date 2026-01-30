const express = require('express');
const ProductController = require('../controllers/product.controller');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

// Product CRUD routes
router.post('/products', 
  authenticateToken, 
  requireRole(['admin']), 
  ProductController.createProduct
);

router.get('/products', 
  authenticateToken, 
  ProductController.getProducts
);

router.get('/products/:id', 
  authenticateToken, 
  ProductController.getProduct
);

router.put('/products/:id', 
  authenticateToken, 
  requireRole(['admin']), 
  ProductController.updateProduct
);

router.delete('/products/:id', 
  authenticateToken, 
  requireRole(['admin']), 
  ProductController.deleteProduct
);

// Product cost calculation routes
router.post('/products/:id/calculate-cost', 
  authenticateToken, 
  requireRole(['admin']), 
  ProductController.calculateProductCost
);

router.put('/products/:id/price', 
  authenticateToken, 
  requireRole(['admin']), 
  ProductController.updateSellingPrice
);

router.get('/products/cost-analysis', 
  authenticateToken, 
  ProductController.getRecipeCostAnalysis
);

module.exports = router;

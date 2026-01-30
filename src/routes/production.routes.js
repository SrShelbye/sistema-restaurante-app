const express = require('express');
const ProductionController = require('../controllers/production.controller');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

// Production Area CRUD routes
router.post('/', 
  authenticateToken, 
  requireRole(['admin']), 
  ProductionController.createProductionArea
);

router.get('/', 
  authenticateToken, 
  ProductionController.getProductionAreas
);

router.get('/:id', 
  authenticateToken, 
  ProductionController.getProductionArea
);

router.put('/:id', 
  authenticateToken, 
  requireRole(['admin']), 
  ProductionController.updateProductionArea
);

router.delete('/:id', 
  authenticateToken, 
  requireRole(['admin']), 
  ProductionController.deleteProductionArea
);

module.exports = router;

const express = require('express');
const ProductionController = require('../controllers/production.controller');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

// Production Area CRUD routes
router.post('/production-areas', 
  authenticateToken, 
  requireRole(['admin']), 
  ProductionController.createProductionArea
);

router.get('/production-areas', 
  authenticateToken, 
  ProductionController.getProductionAreas
);

router.get('/production-areas/:id', 
  authenticateToken, 
  ProductionController.getProductionArea
);

router.put('/production-areas/:id', 
  authenticateToken, 
  requireRole(['admin']), 
  ProductionController.updateProductionArea
);

router.delete('/production-areas/:id', 
  authenticateToken, 
  requireRole(['admin']), 
  ProductionController.deleteProductionArea
);

module.exports = router;

const express = require('express');
const OrdersController = require('../controllers/orders.controller');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

// Order CRUD routes
router.post('/', 
  authenticateToken, 
  OrdersController.createOrder
);

router.get('/', 
  authenticateToken, 
  OrdersController.getOrders
);

router.get('/actives', 
  authenticateToken, 
  OrdersController.getActiveOrders
);

router.get('/:id', 
  authenticateToken, 
  OrdersController.getOrder
);

router.put('/:id', 
  authenticateToken, 
  requireRole(['admin']), 
  OrdersController.updateOrder
);

router.post('/:id/complete', 
  authenticateToken, 
  OrdersController.completeOrder
);

router.post('/:id/cancel', 
  authenticateToken, 
  requireRole(['admin']), 
  OrdersController.cancelOrder
);

module.exports = router;

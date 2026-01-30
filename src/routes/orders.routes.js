const express = require('express');
const OrdersController = require('../controllers/orders.controller');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

// Order CRUD routes
router.post('/orders', 
  authenticateToken, 
  OrdersController.createOrder
);

router.get('/orders', 
  authenticateToken, 
  OrdersController.getOrders
);

router.get('/orders/actives', 
  authenticateToken, 
  OrdersController.getActiveOrders
);

router.get('/orders/:id', 
  authenticateToken, 
  OrdersController.getOrder
);

router.put('/orders/:id', 
  authenticateToken, 
  requireRole(['admin']), 
  OrdersController.updateOrder
);

router.post('/orders/:id/complete', 
  authenticateToken, 
  OrdersController.completeOrder
);

router.post('/orders/:id/cancel', 
  authenticateToken, 
  requireRole(['admin']), 
  OrdersController.cancelOrder
);

module.exports = router;

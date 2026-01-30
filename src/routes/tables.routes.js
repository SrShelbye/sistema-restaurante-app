const express = require('express');
const TablesController = require('../controllers/tables.controller');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

// Table CRUD routes
router.post('/tables', 
  authenticateToken, 
  requireRole(['admin']), 
  TablesController.createTable
);

router.get('/tables', 
  authenticateToken, 
  TablesController.getTables
);

router.get('/tables/:id', 
  authenticateToken, 
  TablesController.getTable
);

router.put('/tables/:id', 
  authenticateToken, 
  requireRole(['admin']), 
  TablesController.updateTable
);

router.delete('/tables/:id', 
  authenticateToken, 
  requireRole(['admin']), 
  TablesController.deleteTable
);

router.patch('/tables/:id/status', 
  authenticateToken, 
  TablesController.updateTableStatus
);

router.get('/tables/status', 
  authenticateToken, 
  TablesController.getTableStatus
);

module.exports = router;

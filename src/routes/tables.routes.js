const express = require('express');
const TablesController = require('../controllers/tables.controller');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

// Table CRUD routes
router.post('/', 
  authenticateToken, 
  requireRole(['admin']), 
  TablesController.createTable
);

router.get('/', 
  authenticateToken, 
  TablesController.getTables
);

router.get('/:id', 
  authenticateToken, 
  TablesController.getTable
);

router.put('/:id', 
  authenticateToken, 
  requireRole(['admin']), 
  TablesController.updateTable
);

router.delete('/:id', 
  authenticateToken, 
  requireRole(['admin']), 
  TablesController.deleteTable
);

router.patch('/:id/status', 
  authenticateToken, 
  TablesController.updateTableStatus
);

router.get('/status', 
  authenticateToken, 
  TablesController.getTableStatus
);

module.exports = router;

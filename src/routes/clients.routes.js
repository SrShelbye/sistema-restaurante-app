const express = require('express');
const ClientsController = require('../controllers/clients.controller');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

// Client CRUD routes
router.post('/', 
  authenticateToken, 
  requireRole(['admin']), 
  ClientsController.createClient
);

router.get('/', 
  authenticateToken, 
  ClientsController.getClients
);

router.get('/:id', 
  authenticateToken, 
  ClientsController.getClient
);

router.put('/:id', 
  authenticateToken, 
  requireRole(['admin']), 
  ClientsController.updateClient
);

router.delete('/:id', 
  authenticateToken, 
  requireRole(['admin']), 
  ClientsController.deleteClient
);

module.exports = router;

const express = require('express');
const ClientsController = require('../controllers/clients.controller');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

// Client CRUD routes
router.post('/clients', 
  authenticateToken, 
  requireRole(['admin']), 
  ClientsController.createClient
);

router.get('/clients', 
  authenticateToken, 
  ClientsController.getClients
);

router.get('/clients/:id', 
  authenticateToken, 
  ClientsController.getClient
);

router.put('/clients/:id', 
  authenticateToken, 
  requireRole(['admin']), 
  ClientsController.updateClient
);

router.delete('/clients/:id', 
  authenticateToken, 
  requireRole(['admin']), 
  ClientsController.deleteClient
);

module.exports = router;

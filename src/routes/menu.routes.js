const express = require('express');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

// Temporary basic menu routes - to be expanded later
const router = express.Router();

// These are basic CRUD operations for menu sections, categories, and products
// You can expand these with proper controllers later

router.get('/sections', authenticateToken, (req, res) => {
  // Temporary response - implement with proper controller
  res.json({
    success: true,
    data: [],
    message: 'Sections endpoint - implement with proper controller'
  });
});

router.post('/sections', authenticateToken, requireRole(['admin']), (req, res) => {
  // Temporary response - implement with proper controller
  res.status(201).json({
    success: true,
    data: req.body,
    message: 'Section created - implement with proper controller'
  });
});

router.get('/categories', authenticateToken, (req, res) => {
  // Temporary response - implement with proper controller
  res.json({
    success: true,
    data: [],
    message: 'Categories endpoint - implement with proper controller'
  });
});

router.post('/categories', authenticateToken, requireRole(['admin']), (req, res) => {
  // Temporary response - implement with proper controller
  res.status(201).json({
    success: true,
    data: req.body,
    message: 'Category created - implement with proper controller'
  });
});

router.get('/products', authenticateToken, (req, res) => {
  // Temporary response - implement with proper controller
  res.json({
    success: true,
    data: [],
    message: 'Products endpoint - implement with proper controller'
  });
});

router.post('/products', authenticateToken, requireRole(['admin']), (req, res) => {
  // Temporary response - implement with proper controller
  res.status(201).json({
    success: true,
    data: req.body,
    message: 'Product created - implement with proper controller'
  });
});

module.exports = router;

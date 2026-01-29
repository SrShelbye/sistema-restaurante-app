const express = require('express');
const AuthController = require('../controllers/auth.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

const router = express.Router();

// Login
router.post('/login', AuthController.login);

// Register
router.post('/register', AuthController.register);

// Logout
router.post('/logout', authenticateToken, AuthController.logout);

// Get current user
router.get('/me', authenticateToken, AuthController.getCurrentUser);

module.exports = router;

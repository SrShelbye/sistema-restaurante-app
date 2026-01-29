const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Restaurant = require('../models/Restaurant');

class AuthController {
  // Login
  static async login(req, res) {
    try {
      const { email, password } = req.body;

      // Find user by email
      const user = await User.findOne({ email, isActive: true }).populate('restaurantId');
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Credenciales inválidas'
        });
      }

      // Check password
      const isPasswordValid = await user.comparePassword(password);
      
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Credenciales inválidas'
        });
      }

      // Update last login and online status
      user.lastLogin = new Date();
      user.online = true;
      await user.save();

      // Generate JWT token
      const payload = {
        userId: user._id.toString(),
        email: user.email,
        role: user.role
      };

      const token = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
      });

      // Get restaurant if user has one
      let restaurant = null;
      if (user.restaurantId) {
        restaurant = await Restaurant.findById(user.restaurantId);
      }

      res.json({
        success: true,
        data: {
          token,
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            restaurantId: user.restaurantId
          },
          restaurant
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Error en el servidor'
      });
    }
  }

  // Register
  static async register(req, res) {
    try {
      const { username, email, password, firstName, lastName, phone, restaurantName } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [{ email }, { username }],
        isActive: true
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'El usuario ya existe'
        });
      }

      // Create user
      const user = new User({
        username,
        email,
        password,
        firstName,
        lastName,
        phone,
        role: 'admin' // First user is admin
      });

      await user.save();

      // Create restaurant if provided
      let restaurant = null;
      if (restaurantName) {
        restaurant = new Restaurant({
          name: restaurantName,
          address: 'Dirección por defecto',
          phone: phone || '0000000000',
          email: email,
          capacity: 20,
          owner: user._id
        });

        await restaurant.save();

        // Link restaurant to user
        user.restaurantId = restaurant._id;
        await user.save();
      }

      // Generate JWT token
      const payload = {
        userId: user._id.toString(),
        email: user.email,
        role: user.role
      };

      const token = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
      });

      res.status(201).json({
        success: true,
        data: {
          token,
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            restaurantId: user.restaurantId
          },
          restaurant
        }
      });
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({
        success: false,
        message: 'Error en el servidor'
      });
    }
  }

  // Logout
  static async logout(req, res) {
    try {
      const userId = req.user?.userId;

      if (userId) {
        await User.findByIdAndUpdate(userId, { online: false });
      }

      res.json({
        success: true,
        message: 'Sesión cerrada exitosamente'
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        message: 'Error en el servidor'
      });
    }
  }

  // Get current user
  static async getCurrentUser(req, res) {
    try {
      const userId = req.user?.userId;

      const user = await User.findById(userId).populate('restaurantId');
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      let restaurant = null;
      if (user.restaurantId) {
        restaurant = await Restaurant.findById(user.restaurantId);
      }

      res.json({
        success: true,
        data: {
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            online: user.online,
            lastLogin: user.lastLogin,
            restaurantId: user.restaurantId
          },
          restaurant
        }
      });
    } catch (error) {
      console.error('Get current user error:', error);
      res.status(500).json({
        success: false,
        message: 'Error en el servidor'
      });
    }
  }

  // Renew token
  static async renewToken(req, res) {
    try {
      const userId = req.user?.userId;

      const user = await User.findById(userId).populate('restaurantId');
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      // Generate new JWT token
      const payload = {
        userId: user._id.toString(),
        email: user.email,
        role: user.role
      };

      const token = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
      });

      let restaurant = null;
      if (user.restaurantId) {
        restaurant = await Restaurant.findById(user.restaurantId);
      }

      res.json({
        success: true,
        data: {
          token,
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            online: user.online,
            lastLogin: user.lastLogin,
            restaurantId: user.restaurantId
          },
          restaurant
        }
      });
    } catch (error) {
      console.error('Renew token error:', error);
      res.status(500).json({
        success: false,
        message: 'Error en el servidor'
      });
    }
  }
}

module.exports = AuthController;

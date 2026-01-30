const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Restaurant = require('../models/Restaurant');

const mapRole = (role) => {
  switch (role) {
    case 'admin':
      return { id: 1, name: 'admin', description: 'Administrador' };
    case 'despachador':
      return { id: 2, name: 'despachador', description: 'Despachador' };
    case 'gerente':
      return { id: 3, name: 'gerente', description: 'Gerente' };
    case 'mesero':
    default:
      return { id: 4, name: 'mesero', description: 'Mesero' };
  }
};

const toFrontendRestaurant = (restaurant) => {
  if (!restaurant) return null;

  return {
    id: restaurant._id.toString(),
    name: restaurant.name,
    logo: restaurant.logo || '',
    address: restaurant.address,
    capacity: restaurant.capacity,
    identification: '',
    phone: restaurant.phone,
    email: restaurant.email,
    percentageAttendance: 0,
    simulationEndDate: '',
    simulationStartDate: '',
    lastSimulationUpdate: '',
    lastPredictionUpdate: Date.now()
  };
};

const getJwtSecret = () => {
  return process.env.JWT_SECRET && String(process.env.JWT_SECRET).trim()
    ? process.env.JWT_SECRET
    : null;
};

const toFrontendUser = (user, restaurant) => {
  const role = mapRole(user.role);
  const currentRestaurant = toFrontendRestaurant(restaurant);

  return {
    id: user._id.toString(),
    username: user.username,
    person: {
      id: user._id.toString(),
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      numPhone: user.phone || ''
    },
    online: user.online,
    restaurantRoles: currentRestaurant
      ? [
          {
            id: 1,
            restaurant: currentRestaurant,
            role
          }
        ]
      : [],
    isActive: user.isActive,
    role
  };
};

class AuthController {
  // Login
  static async login(req, res) {
    try {
      const { email, username, password } = req.body;
      const identifier = email || username;

      if (!identifier || !password) {
        return res.status(400).json({
          success: false,
          message: 'Faltan credenciales'
        });
      }

      // Find user by email
      const user = await User.findOne({
        $or: [{ email: identifier }, { username: identifier }],
        isActive: true
      }).populate('restaurantId');
      
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
      const jwtSecret = getJwtSecret();
      if (!jwtSecret) {
        return res.status(500).json({
          success: false,
          message: 'JWT_SECRET no configurado en el servidor'
        });
      }

      const payload = {
        userId: user._id.toString(),
        email: user.email,
        role: user.role
      };

      const token = jwt.sign(payload, jwtSecret, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
      });

      let restaurant = null;
      if (user.restaurantId) restaurant = await Restaurant.findById(user.restaurantId);

      res.json({
        token,
        user: toFrontendUser(user, restaurant),
        currentRestaurant: toFrontendRestaurant(restaurant)
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
      console.log('Register request body:', req.body);
      
      const { username, email, password, firstName, lastName, phone, numPhone, restaurantName, samePassword } = req.body;
      const phoneValue = phone || numPhone || '';

      // Basic validation
      if (!username || !email || !password || !firstName || !lastName) {
        return res.status(400).json({
          success: false,
          message: 'Faltan campos requeridos: username, email, password, firstName, lastName'
        });
      }

      // Validate passwords match if provided
      if (samePassword && password !== samePassword) {
        return res.status(400).json({
          success: false,
          message: 'Las contraseñas no coinciden'
        });
      }

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
        phone: phoneValue,
        role: 'admin' // First user is admin
      });

      await user.save();

      let restaurant = new Restaurant({
        name: restaurantName || `Restaurante de ${firstName}`,
        address: 'Dirección por defecto',
        phone: phoneValue || '0000000000',
        email: email,
        capacity: 20,
        owner: user._id
      });

      await restaurant.save();

      user.restaurantId = restaurant._id;
      await user.save();

      // Generate JWT token
      const jwtSecret = getJwtSecret();
      if (!jwtSecret) {
        return res.status(500).json({
          success: false,
          message: 'JWT_SECRET no configurado en el servidor'
        });
      }

      const payload = {
        userId: user._id.toString(),
        email: user.email,
        role: user.role
      };

      const token = jwt.sign(payload, jwtSecret, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
      });

      console.log('User registered successfully:', { username, email });

      res.status(201).json({
        token,
        user: toFrontendUser(user, restaurant),
        currentRestaurant: toFrontendRestaurant(restaurant)
      });
    } catch (error) {
      console.error('Register error:', error);

      if (error && error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'El usuario ya existe'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Error en el servidor: ' + error.message
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
        user: toFrontendUser(user, restaurant),
        currentRestaurant: toFrontendRestaurant(restaurant)
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
      const jwtSecret = getJwtSecret();
      if (!jwtSecret) {
        return res.status(500).json({
          success: false,
          message: 'JWT_SECRET no configurado en el servidor'
        });
      }

      const payload = {
        userId: user._id.toString(),
        email: user.email,
        role: user.role
      };

      const token = jwt.sign(payload, jwtSecret, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
      });

      let restaurant = null;
      if (user.restaurantId) {
        restaurant = await Restaurant.findById(user.restaurantId);
      }

      res.json({
        token,
        user: toFrontendUser(user, restaurant),
        currentRestaurant: toFrontendRestaurant(restaurant)
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

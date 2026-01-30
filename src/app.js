const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server: SocketIOServer } = require('socket.io');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth.routes');
const inventoryRoutes = require('./routes/inventory.routes');
const recipeRoutes = require('./routes/recipe.routes');
const purchasingRoutes = require('./routes/purchasing.routes');
const salesRoutes = require('./routes/sales.routes');
const reportsRoutes = require('./routes/reports.routes');
const menuRoutes = require('./routes/menu.routes');
const ordersRoutes = require('./routes/orders.routes');
const tablesRoutes = require('./routes/tables.routes');
const productionRoutes = require('./routes/production.routes');
const cashRoutes = require('./routes/cash.routes');
const clientsRoutes = require('./routes/clients.routes');

const app = express();
const server = createServer(app);

// CORS configuration - Allow GitHub Pages and development origins
const allowedOrigins = [
  'https://srshelbye.github.io',
  'https://srshelbye.github.io/sistema-restaurante-app',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173'
];

// Socket.IO setup
const io = new SocketIOServer(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    credentials: true
  }
});

// Security middleware
app.use(helmet());

// CORS configuration - Allow GitHub Pages and development origins
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  }
});

app.use('/api', limiter);

// General middleware
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/purchasing', purchasingRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/tables', tablesRoutes);
app.use('/api/production-areas', productionRoutes);
app.use('/api/cash-register', cashRoutes);
app.use('/api/clients', clientsRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Restaurant Management API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      auth: '/api/auth',
      inventory: '/api/inventory',
      recipes: '/api/recipes',
      purchasing: '/api/purchasing',
      sales: '/api/sales',
      reports: '/api/reports',
      menu: '/api/menu',
      orders: '/api/orders',
      tables: '/api/tables',
      production: '/api/production-areas',
      cash: '/api/cash-register',
      clients: '/api/clients'
    }
  });
});

// Handle 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join restaurant room
  socket.on('join-restaurant', (restaurantId) => {
    socket.join(`restaurant-${restaurantId}`);
    console.log(`User ${socket.id} joined restaurant ${restaurantId}`);
  });

  // Handle new order
  socket.on('new-order', (orderData) => {
    socket.to(`restaurant-${orderData.restaurantId}`).emit('order-created', orderData);
  });

  // Handle order status update
  socket.on('update-order-status', (orderData) => {
    socket.to(`restaurant-${orderData.restaurantId}`).emit('order-updated', orderData);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

module.exports = { app, server, io };

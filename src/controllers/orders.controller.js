const Order = require('../models/Order');
const Table = require('../models/Table');

class OrdersController {
  static async createOrder(req, res) {
    try {
      const orderData = {
        ...req.body,
        restaurantId: req.user.restaurantId || req.body.restaurantId,
        createdBy: req.user.userId || req.body.createdBy
      };

      // Calculate totals
      let subtotal = 0;
      orderData.details = orderData.details.map(detail => {
        const totalPrice = detail.quantity * detail.unitPrice;
        subtotal += totalPrice;
        return {
          ...detail,
          totalPrice
        };
      });

      orderData.subtotal = subtotal;
      orderData.total = subtotal + (orderData.taxAmount || 0);

      const order = new Order(orderData);
      await order.save();

      // Update table status if table is provided
      if (order.tableId) {
        await Table.findByIdAndUpdate(
          order.tableId,
          { 
            status: 'occupied',
            currentOrderId: order._id
          }
        );
      }

      await order.populate([
        {
          path: 'tableId',
          select: 'number capacity location status'
        },
        {
          path: 'details.productId',
          select: 'name category'
        },
        {
          path: 'createdBy',
          select: 'username firstName lastName'
        }
      ]);

      res.status(201).json({
        success: true,
        data: order
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'Número de orden duplicado'
        });
      }
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async getOrders(req, res) {
    try {
      const {
        page = 1,
        limit = 50,
        status,
        tableId,
        startDate,
        endDate,
        search
      } = req.query;

      const restaurantId = req.user.restaurantId || req.query.restaurantId;
      const filter = { restaurantId };

      if (status) filter.status = status;
      if (tableId) filter.tableId = tableId;
      if (search) {
        filter.orderNumber = { $regex: search, $options: 'i' };
      }

      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate) filter.createdAt.$lte = new Date(endDate);
      }

      const orders = await Order.find(filter)
        .populate('tableId', 'number capacity location status')
        .populate('details.productId', 'name category')
        .populate('createdBy', 'username firstName lastName')
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .sort({ createdAt: -1 });

      const total = await Order.countDocuments(filter);

      res.json({
        success: true,
        data: {
          orders,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async getActiveOrders(req, res) {
    try {
      const { limit = 50, offset = 0, startDate, period = 'daily' } = req.query;
      const restaurantId = req.user.restaurantId || req.query.restaurantId;

      let dateFilter = {};
      if (startDate) {
        const start = new Date(startDate);
        if (period === 'daily') {
          dateFilter = {
            $gte: new Date(start.setHours(0, 0, 0, 0)),
            $lt: new Date(start.setHours(23, 59, 59, 999))
          };
        } else if (period === 'weekly') {
          const weekStart = new Date(start.setDate(start.getDate() - start.getDay()));
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 6);
          dateFilter = {
            $gte: new Date(weekStart.setHours(0, 0, 0, 0)),
            $lt: new Date(weekEnd.setHours(23, 59, 59, 999))
          };
        } else if (period === 'monthly') {
          dateFilter = {
            $gte: new Date(start.getFullYear(), start.getMonth(), 1),
            $lt: new Date(start.getFullYear(), start.getMonth() + 1, 1)
          };
        } else if (period === 'yearly') {
          dateFilter = {
            $gte: new Date(start.getFullYear(), 0, 1),
            $lt: new Date(start.getFullYear() + 1, 0, 1)
          };
        }
      }

      const orders = await Order.find({
        restaurantId,
        status: 'active',
        ...(startDate && { createdAt: dateFilter })
      })
        .populate('tableId', 'number capacity location status')
        .populate('details.productId', 'name category')
        .populate('createdBy', 'username firstName lastName')
        .limit(parseInt(limit))
        .skip(parseInt(offset))
        .sort({ createdAt: -1 });

      const total = await Order.countDocuments({
        restaurantId,
        status: 'active',
        ...(startDate && { createdAt: dateFilter })
      });

      res.json({
        success: true,
        data: {
          orders,
          total,
          limit: parseInt(limit),
          offset: parseInt(offset)
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async getOrder(req, res) {
    try {
      const order = await Order.findOne({
        _id: req.params.id,
        restaurantId: req.user.restaurantId
      })
        .populate('tableId', 'number capacity location status')
        .populate('details.productId', 'name category')
        .populate('createdBy', 'username firstName lastName');

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Orden no encontrada'
        });
      }

      res.json({
        success: true,
        data: order
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async updateOrder(req, res) {
    try {
      const order = await Order.findOneAndUpdate(
        {
          _id: req.params.id,
          restaurantId: req.user.restaurantId
        },
        req.body,
        { new: true, runValidators: true }
      )
        .populate('tableId', 'number capacity location status')
        .populate('details.productId', 'name category')
        .populate('createdBy', 'username firstName lastName');

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Orden no encontrada'
        });
      }

      res.json({
        success: true,
        data: order
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async completeOrder(req, res) {
    try {
      const order = await Order.findOne({
        _id: req.params.id,
        restaurantId: req.user.restaurantId
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Orden no encontrada'
        });
      }

      order.status = 'completed';
      await order.save();

      // Update table status if table is assigned
      if (order.tableId) {
        await Table.findByIdAndUpdate(
          order.tableId,
          { 
            status: 'cleaning',
            currentOrderId: null
          }
        );
      }

      res.json({
        success: true,
        message: 'Orden completada exitosamente'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async cancelOrder(req, res) {
    try {
      const order = await Order.findOne({
        _id: req.params.id,
        restaurantId: req.user.restaurantId
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Orden no encontrada'
        });
      }

      order.status = 'cancelled';
      await order.save();

      // Update table status if table is assigned
      if (order.tableId) {
        await Table.findByIdAndUpdate(
          order.tableId,
          { 
            status: 'available',
            currentOrderId: null
          }
        );
      }

      res.json({
        success: true,
        message: 'Orden cancelada exitosamente'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = OrdersController;

const CashRegister = require('../models/CashRegister');

class CashController {
  static async openCashRegister(req, res) {
    try {
      const cashData = {
        ...req.body,
        restaurantId: req.user.restaurantId || req.body.restaurantId,
        openedBy: req.user.userId || req.body.openedBy,
        status: 'active'
      };

      // Check if there's already an active register for today
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0));
      const endOfDay = new Date(today.setHours(23, 59, 59, 999));

      const existingRegister = await CashRegister.findOne({
        restaurantId: cashData.restaurantId,
        date: {
          $gte: startOfDay,
          $lte: endOfDay
        },
        status: 'active'
      });

      if (existingRegister) {
        return res.status(400).json({
          success: false,
          message: 'Ya existe una caja registradora activa para hoy'
        });
      }

      const cashRegister = new CashRegister(cashData);
      await cashRegister.save();

      await cashRegister.populate([
        {
          path: 'openedBy',
          select: 'username firstName lastName'
        }
      ]);

      res.status(201).json({
        success: true,
        data: cashRegister
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async getActiveCashRegisters(req, res) {
    try {
      const restaurantId = req.user.restaurantId || req.query.restaurantId;
      
      const activeRegisters = await CashRegister.find({
        restaurantId,
        status: 'active'
      })
        .populate('openedBy', 'username firstName lastName')
        .sort({ date: -1 });

      res.json({
        success: true,
        data: activeRegisters
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async closeCashRegister(req, res) {
    try {
      const { closingAmount, notes } = req.body;
      
      const cashRegister = await CashRegister.findOne({
        _id: req.params.id,
        restaurantId: req.user.restaurantId,
        status: 'active'
      });

      if (!cashRegister) {
        return res.status(404).json({
          success: false,
          message: 'Caja registradora no encontrada o ya cerrada'
        });
      }

      cashRegister.closingAmount = closingAmount;
      cashRegister.status = 'closed';
      cashRegister.closedBy = req.user.userId;
      cashRegister.closedAt = new Date();

      // Add closing transaction
      cashRegister.transactions.push({
        type: 'closing',
        amount: closingAmount,
        description: notes || 'Cierre de caja',
        timestamp: new Date()
      });

      await cashRegister.save();

      await cashRegister.populate([
        {
          path: 'openedBy',
          select: 'username firstName lastName'
        },
        {
          path: 'closedBy',
          select: 'username firstName lastName'
        }
      ]);

      res.json({
        success: true,
        data: cashRegister,
        message: 'Caja cerrada exitosamente'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async addTransaction(req, res) {
    try {
      const { type, amount, description, paymentMethod } = req.body;
      
      const cashRegister = await CashRegister.findOne({
        _id: req.params.id,
        restaurantId: req.user.restaurantId,
        status: 'active'
      });

      if (!cashRegister) {
        return res.status(404).json({
          success: false,
          message: 'Caja registradora no encontrada o inactiva'
        });
      }

      cashRegister.transactions.push({
        type,
        amount,
        description,
        paymentMethod,
        timestamp: new Date()
      });

      // Update totals
      if (type === 'sale') {
        cashRegister.totalSales += amount;
      } else if (type === 'expense') {
        cashRegister.totalExpenses += amount;
      }

      await cashRegister.save();

      res.json({
        success: true,
        data: cashRegister
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async getCashRegisterHistory(req, res) {
    try {
      const { page = 1, limit = 50, startDate, endDate } = req.query;
      const restaurantId = req.user.restaurantId || req.query.restaurantId;
      const filter = { restaurantId };

      if (startDate || endDate) {
        filter.date = {};
        if (startDate) filter.date.$gte = new Date(startDate);
        if (endDate) filter.date.$lte = new Date(endDate);
      }

      const registers = await CashRegister.find(filter)
        .populate('openedBy', 'username firstName lastName')
        .populate('closedBy', 'username firstName lastName')
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .sort({ date: -1 });

      const total = await CashRegister.countDocuments(filter);

      res.json({
        success: true,
        data: {
          registers,
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

  static async getCashRegisterSummary(req, res) {
    try {
      const restaurantId = req.user.restaurantId || req.query.restaurantId;
      const { startDate, endDate } = req.query;

      const dateFilter = {};
      if (startDate) dateFilter.$gte = new Date(startDate);
      if (endDate) dateFilter.$lte = new Date(endDate);

      const summary = await CashRegister.aggregate([
        {
          $match: {
            restaurantId: require('mongoose').Types.ObjectId(restaurantId),
            date: dateFilter
          }
        },
        {
          $group: {
            _id: null,
            totalOpening: { $sum: '$openingAmount' },
            totalClosing: { $sum: '$closingAmount' },
            totalSales: { $sum: '$totalSales' },
            totalExpenses: { $sum: '$totalExpenses' },
            registerCount: { $sum: 1 }
          }
        }
      ]);

      res.json({
        success: true,
        data: summary[0] || {
          totalOpening: 0,
          totalClosing: 0,
          totalSales: 0,
          totalExpenses: 0,
          registerCount: 0
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = CashController;

const Table = require('../models/Table');

class TablesController {
  static async createTable(req, res) {
    try {
      const tableData = {
        ...req.body,
        restaurantId: req.user.restaurantId || req.body.restaurantId
      };

      const table = new Table(tableData);
      await table.save();

      res.status(201).json({
        success: true,
        data: table
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'El número de mesa ya existe'
        });
      }
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async getTables(req, res) {
    try {
      const { page = 1, limit = 50, status, location, search } = req.query;
      const restaurantId = req.user.restaurantId || req.query.restaurantId;
      const filter = { restaurantId, isActive: true };

      if (status) filter.status = status;
      if (location) filter.location = location;
      if (search) {
        filter.number = { $regex: search, $options: 'i' };
      }

      const tables = await Table.find(filter)
        .populate('currentOrderId', 'orderNumber status')
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .sort({ number: 1 });

      const total = await Table.countDocuments(filter);

      res.json({
        success: true,
        data: {
          tables,
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

  static async getTable(req, res) {
    try {
      const table = await Table.findOne({
        _id: req.params.id,
        restaurantId: req.user.restaurantId
      }).populate('currentOrderId', 'orderNumber status');

      if (!table) {
        return res.status(404).json({
          success: false,
          message: 'Mesa no encontrada'
        });
      }

      res.json({
        success: true,
        data: table
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async updateTable(req, res) {
    try {
      const table = await Table.findOneAndUpdate(
        {
          _id: req.params.id,
          restaurantId: req.user.restaurantId
        },
        req.body,
        { new: true, runValidators: true }
      ).populate('currentOrderId', 'orderNumber status');

      if (!table) {
        return res.status(404).json({
          success: false,
          message: 'Mesa no encontrada'
        });
      }

      res.json({
        success: true,
        data: table
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async deleteTable(req, res) {
    try {
      const table = await Table.findOneAndUpdate(
        {
          _id: req.params.id,
          restaurantId: req.user.restaurantId
        },
        { isActive: false },
        { new: true }
      );

      if (!table) {
        return res.status(404).json({
          success: false,
          message: 'Mesa no encontrada'
        });
      }

      res.json({
        success: true,
        message: 'Mesa eliminada correctamente'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async updateTableStatus(req, res) {
    try {
      const { status } = req.body;
      
      const table = await Table.findOneAndUpdate(
        {
          _id: req.params.id,
          restaurantId: req.user.restaurantId
        },
        { status },
        { new: true, runValidators: true }
      ).populate('currentOrderId', 'orderNumber status');

      if (!table) {
        return res.status(404).json({
          success: false,
          message: 'Mesa no encontrada'
        });
      }

      res.json({
        success: true,
        data: table
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async getTableStatus(req, res) {
    try {
      const restaurantId = req.user.restaurantId || req.query.restaurantId;
      
      const statusSummary = await Table.aggregate([
        {
          $match: {
            restaurantId: require('mongoose').Types.ObjectId(restaurantId),
            isActive: true
          }
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      const summary = {
        total: 0,
        available: 0,
        occupied: 0,
        reserved: 0,
        cleaning: 0
      };

      statusSummary.forEach(item => {
        summary[item._id] = item.count;
        summary.total += item.count;
      });

      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = TablesController;

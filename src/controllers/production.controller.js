const ProductionArea = require('../models/ProductionArea');

class ProductionController {
  static async createProductionArea(req, res) {
    try {
      const areaData = {
        ...req.body,
        restaurantId: req.user.restaurantId || req.body.restaurantId
      };

      const area = new ProductionArea(areaData);
      await area.save();

      res.status(201).json({
        success: true,
        data: area
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'El área de producción ya existe'
        });
      }
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async getProductionAreas(req, res) {
    try {
      const { page = 1, limit = 50, search } = req.query;
      const restaurantId = req.user.restaurantId || req.query.restaurantId;
      const filter = { restaurantId, isActive: true };

      if (search) {
        filter.name = { $regex: search, $options: 'i' };
      }

      const areas = await ProductionArea.find(filter)
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .sort({ name: 1 });

      const total = await ProductionArea.countDocuments(filter);

      res.json({
        success: true,
        data: {
          areas,
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

  static async getProductionArea(req, res) {
    try {
      const area = await ProductionArea.findOne({
        _id: req.params.id,
        restaurantId: req.user.restaurantId
      });

      if (!area) {
        return res.status(404).json({
          success: false,
          message: 'Área de producción no encontrada'
        });
      }

      res.json({
        success: true,
        data: area
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async updateProductionArea(req, res) {
    try {
      const area = await ProductionArea.findOneAndUpdate(
        {
          _id: req.params.id,
          restaurantId: req.user.restaurantId
        },
        req.body,
        { new: true, runValidators: true }
      );

      if (!area) {
        return res.status(404).json({
          success: false,
          message: 'Área de producción no encontrada'
        });
      }

      res.json({
        success: true,
        data: area
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async deleteProductionArea(req, res) {
    try {
      const area = await ProductionArea.findOneAndUpdate(
        {
          _id: req.params.id,
          restaurantId: req.user.restaurantId
        },
        { isActive: false },
        { new: true }
      );

      if (!area) {
        return res.status(404).json({
          success: false,
          message: 'Área de producción no encontrada'
        });
      }

      res.json({
        success: true,
        message: 'Área de producción eliminada correctamente'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = ProductionController;

const Supplier = require('../models/Supplier');
const Purchase = require('../models/Purchase');
const Ingredient = require('../models/Ingredient');

class PurchasingController {
  // Suppliers CRUD
  static async createSupplier(req, res) {
    try {
      const supplierData = {
        ...req.body,
        restaurantId: req.user.restaurantId || req.body.restaurantId
      };

      const supplier = new Supplier(supplierData);
      await supplier.save();

      res.status(201).json({
        success: true,
        data: supplier
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'El proveedor ya existe'
        });
      }
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async getSuppliers(req, res) {
    try {
      const { page = 1, limit = 50, search, rating } = req.query;
      const restaurantId = req.user.restaurantId || req.query.restaurantId;
      const filter = { restaurantId, isActive: true };

      if (search) {
        filter.name = { $regex: search, $options: 'i' };
      }
      if (rating) {
        filter.rating = parseFloat(rating);
      }

      const suppliers = await Supplier.find(filter)
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .sort({ name: 1 });

      const total = await Supplier.countDocuments(filter);

      res.json({
        success: true,
        data: {
          suppliers,
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

  static async getSupplier(req, res) {
    try {
      const supplier = await Supplier.findOne({
        _id: req.params.id,
        restaurantId: req.user.restaurantId
      });

      if (!supplier) {
        return res.status(404).json({
          success: false,
          message: 'Proveedor no encontrado'
        });
      }

      res.json({
        success: true,
        data: supplier
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async updateSupplier(req, res) {
    try {
      const supplier = await Supplier.findOneAndUpdate(
        {
          _id: req.params.id,
          restaurantId: req.user.restaurantId
        },
        req.body,
        { new: true, runValidators: true }
      );

      if (!supplier) {
        return res.status(404).json({
          success: false,
          message: 'Proveedor no encontrado'
        });
      }

      res.json({
        success: true,
        data: supplier
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async deleteSupplier(req, res) {
    try {
      const supplier = await Supplier.findOneAndUpdate(
        {
          _id: req.params.id,
          restaurantId: req.user.restaurantId
        },
        { isActive: false },
        { new: true }
      );

      if (!supplier) {
        return res.status(404).json({
          success: false,
          message: 'Proveedor no encontrado'
        });
      }

      res.json({
        success: true,
        message: 'Proveedor eliminado correctamente'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Purchases CRUD
  static async createPurchase(req, res) {
    try {
      const purchaseData = {
        ...req.body,
        restaurantId: req.user.restaurantId || req.body.restaurantId,
        createdBy: req.user.userId || req.body.createdBy
      };

      // Calculate totals
      let subtotal = 0;
      purchaseData.items = purchaseData.items.map(item => {
        const totalCost = item.quantity * item.unitCost;
        subtotal += totalCost;
        return {
          ...item,
          totalCost
        };
      });

      purchaseData.subtotal = subtotal;
      purchaseData.total = subtotal + (purchaseData.taxAmount || 0);

      const purchase = new Purchase(purchaseData);
      await purchase.save();

      await purchase.populate([
        {
          path: 'supplierId',
          select: 'name phone email'
        },
        {
          path: 'items.ingredientId',
          select: 'name unit'
        },
        {
          path: 'createdBy',
          select: 'username firstName lastName'
        }
      ]);

      res.status(201).json({
        success: true,
        data: purchase
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'Número de compra duplicado'
        });
      }
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async getPurchases(req, res) {
    try {
      const {
        page = 1,
        limit = 50,
        supplierId,
        status,
        startDate,
        endDate,
        search
      } = req.query;

      const restaurantId = req.user.restaurantId || req.query.restaurantId;
      const filter = { restaurantId };

      if (supplierId) filter.supplierId = supplierId;
      if (status) filter.status = status;
      if (search) {
        filter.purchaseNumber = { $regex: search, $options: 'i' };
      }

      if (startDate || endDate) {
        filter.purchaseDate = {};
        if (startDate) filter.purchaseDate.$gte = new Date(startDate);
        if (endDate) filter.purchaseDate.$lte = new Date(endDate);
      }

      const purchases = await Purchase.find(filter)
        .populate('supplierId', 'name phone email')
        .populate('items.ingredientId', 'name unit')
        .populate('createdBy', 'username firstName lastName')
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .sort({ purchaseDate: -1 });

      const total = await Purchase.countDocuments(filter);

      res.json({
        success: true,
        data: {
          purchases,
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

  static async getPurchase(req, res) {
    try {
      const purchase = await Purchase.findOne({
        _id: req.params.id,
        restaurantId: req.user.restaurantId
      })
        .populate('supplierId', 'name phone email address')
        .populate('items.ingredientId', 'name unit currentStock')
        .populate('createdBy', 'username firstName lastName');

      if (!purchase) {
        return res.status(404).json({
          success: false,
          message: 'Compra no encontrada'
        });
      }

      res.json({
        success: true,
        data: purchase
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async receivePurchase(req, res) {
    try {
      const purchase = await Purchase.findOne({
        _id: req.params.id,
        restaurantId: req.user.restaurantId
      });

      if (!purchase) {
        return res.status(404).json({
          success: false,
          message: 'Compra no encontrada'
        });
      }

      if (purchase.status === 'received') {
        return res.status(400).json({
          success: false,
          message: 'La compra ya fue recibida'
        });
      }

      await purchase.updateStock();
      await purchase.populate([
        {
          path: 'supplierId',
          select: 'name phone email'
        },
        {
          path: 'items.ingredientId',
          select: 'name unit currentStock'
        }
      ]);

      res.json({
        success: true,
        data: purchase,
        message: 'Compra recibida y stock actualizado correctamente'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async updatePurchase(req, res) {
    try {
      const purchase = await Purchase.findOneAndUpdate(
        {
          _id: req.params.id,
          restaurantId: req.user.restaurantId
        },
        req.body,
        { new: true, runValidators: true }
      )
        .populate('supplierId', 'name phone email')
        .populate('items.ingredientId', 'name unit')
        .populate('createdBy', 'username firstName lastName');

      if (!purchase) {
        return res.status(404).json({
          success: false,
          message: 'Compra no encontrada'
        });
      }

      res.json({
        success: true,
        data: purchase
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async getPurchaseSummary(req, res) {
    try {
      const restaurantId = req.user.restaurantId || req.query.restaurantId;
      const { startDate, endDate } = req.query;

      const dateFilter = {};
      if (startDate) dateFilter.$gte = new Date(startDate);
      if (endDate) dateFilter.$lte = new Date(endDate);

      const summary = await Purchase.aggregate([
        {
          $match: {
            restaurantId: require('mongoose').Types.ObjectId(restaurantId),
            purchaseDate: dateFilter,
            status: 'received'
          }
        },
        {
          $group: {
            _id: null,
            totalPurchases: { $sum: 1 },
            totalAmount: { $sum: '$total' },
            avgPurchase: { $avg: '$total' },
            totalTax: { $sum: '$taxAmount' }
          }
        }
      ]);

      const topSuppliers = await Purchase.aggregate([
        {
          $match: {
            restaurantId: require('mongoose').Types.ObjectId(restaurantId),
            purchaseDate: dateFilter,
            status: 'received'
          }
        },
        {
          $group: {
            _id: '$supplierId',
            totalAmount: { $sum: '$total' },
            purchaseCount: { $sum: 1 }
          }
        },
        {
          $lookup: {
            from: 'suppliers',
            localField: '_id',
            foreignField: '_id',
            as: 'supplier'
          }
        },
        {
          $unwind: '$supplier'
        },
        {
          $project: {
            supplierName: '$supplier.name',
            totalAmount: 1,
            purchaseCount: 1
          }
        },
        {
          $sort: { totalAmount: -1 },
          $limit: 10
        }
      ]);

      res.json({
        success: true,
        data: {
          summary: summary[0] || {
            totalPurchases: 0,
            totalAmount: 0,
            avgPurchase: 0,
            totalTax: 0
          },
          topSuppliers
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

module.exports = PurchasingController;

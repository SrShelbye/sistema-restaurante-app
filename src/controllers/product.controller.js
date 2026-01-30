const Product = require('../models/Product');
const Ingredient = require('../models/Ingredient');

class ProductController {
  static async createProduct(req, res) {
    try {
      const productData = {
        ...req.body,
        restaurantId: req.user.restaurantId || req.body.restaurantId
      };

      // Calculate costs before saving
      const product = new Product(productData);
      await product.calculateCosts();

      await product.populate([
        {
          path: 'recipe.ingredientId',
          select: 'name unit unitCost currentStock'
        },
        {
          path: 'categoryId',
          select: 'name description'
        },
        {
          path: 'productionAreaId',
          select: 'name description'
        }
      ]);

      res.status(201).json({
        success: true,
        data: product
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'El producto ya existe'
        });
      }
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async getProducts(req, res) {
    try {
      const {
        page = 1,
        limit = 50,
        category,
        search,
        minPrice,
        maxPrice,
        productionArea,
        available
      } = req.query;

      const restaurantId = req.user.restaurantId || req.query.restaurantId;
      const filter = { restaurantId, isActive: true };

      if (category) filter.categoryId = category;
      if (search) {
        filter.name = { $regex: search, $options: 'i' };
      }
      if (minPrice) filter.finalPrice = { $gte: minPrice };
      if (maxPrice) filter.finalPrice = { $lte: maxPrice };
      if (available !== undefined) filter.isAvailable = available === 'true';
      if (productionArea) filter.productionAreaId = productionArea;

      const products = await Product.find(filter)
        .populate([
          {
            path: 'recipe.ingredientId',
            select: 'name unit unitCost currentStock'
          },
          {
            path: 'categoryId',
            select: 'name description'
          },
          {
            path: 'productionAreaId',
            select: 'name description'
          }
        ])
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .sort({ name: 1 });

      const total = await Product.countDocuments(filter);

      res.json({
        success: true,
        data: {
          products,
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

  static async getProduct(req, res) {
    try {
      const product = await Product.findOne({
        _id: req.params.id,
        restaurantId: req.user.restaurantId
      })
        .populate([
          {
            path: 'recipe.ingredientId',
            select: 'name unit unitCost currentStock'
          },
          {
            path: 'categoryId',
            select: 'name description'
          },
          {
            path: 'productionAreaId',
            select: 'name description'
          }
        ]);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Producto no encontrado'
        });
      }

      res.json({
        success: true,
        data: product
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async updateProduct(req, res) {
    try {
      const product = await Product.findOneAndUpdate(
        {
          _id: req.params.id,
          restaurantId: req.user.restaurantId
        },
        req.body,
        { new: true, runValidators: true }
      );

      // Recalculate costs after update
      await product.calculateCosts();

      await product.populate([
        {
          path: 'recipe.ingredientId',
          select: 'name unit unitCost currentStock'
        },
        {
          path: 'categoryId',
          select: 'name description'
        },
        {
          path: 'productionAreaId',
          select: 'name description'
        }
      ]);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Producto no encontrado'
        });
      }

      res.json({
        success: true,
        data: product
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async deleteProduct(req, res) {
    try {
      const product = await Product.findOneAndUpdate(
        {
          _id: req.params.id,
          restaurantId: req.user.restaurantId
        },
        { isActive: false },
        { new: true }
      );

      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Producto no encontrado'
        });
      }

      res.json({
        success: true,
        message: 'Producto eliminado correctamente'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async calculateProductCost(req, res) {
    try {
      const { id } = req.params;
      
      const product = await Product.findOne({
        _id: id,
        restaurantId: req.user.restaurantId
      });

      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Producto no encontrado'
        });
      }

      await product.calculateCosts();

      const ingredientDetails = await product.getIngredientDetails();

      res.json({
        success: true,
        data: {
          product,
          ingredientDetails,
          costBreakdown: ingredientDetails.map(item => ({
            ingredientName: item.ingredientName,
            quantity: item.grossQuantity,
            unit: item.unit,
            cost: item.cost,
            wastePercentage: item.wastePercentage
          }))
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async updateSellingPrice(req, res) {
    try {
      const { marginPercentage } = req.body;
      const { id } = req.params;
      
      const product = await Product.findOne({
        _id: id,
        restaurantId: req.user.restaurantId
      });

      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Producto no encontrado'
        });
      }

      product.marginPercentage = marginPercentage;
      product.finalPrice = product.basePrice * (1 + marginPercentage / 100);
      await product.save();

      res.json({
        success: true,
        data: {
          productId: product._id,
          basePrice: product.basePrice,
          marginPercentage: product.marginPercentage,
          finalPrice: product.finalPrice,
          totalCost: product.totalCost,
          profitMargin: product.profitMargin
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async getRecipeCostAnalysis(req, res) {
    try {
      const restaurantId = req.user.restaurantId;
      
      const products = await Product.find({
        restaurantId,
        isActive: true
      })
        .populate('categoryId', 'name description')
        .populate('productionAreaId', 'name description');

      const analysis = products.map(product => ({
        productId: product._id,
        name: product.name,
        categoryName: product.categoryId?.name || 'Sin categoría',
        totalCost: product.totalCost,
        finalPrice: product.finalPrice,
        marginPercentage: product.marginPercentage,
        profitMargin: product.profitMargin,
        ingredientCount: product.recipe?.length || 0,
        isProfitable: product.profitMargin > 0
      }));

      // Sort by profit margin
      analysis.sort((a, b) => b.profitMargin - a.profitMargin);

      const summary = {
        totalProducts: products.length,
        profitableProducts: analysis.filter(p => p.isProfitable).length,
        averageMargin: analysis.reduce((sum, p) => sum + p.profitMargin, 0) / analysis.length,
        totalCostValue: analysis.reduce((sum, p) => sum + p.totalCost, 0),
        totalRevenueValue: analysis.reduce((sum, p) => sum + p.finalPrice, 0)
      };

      res.json({
        success: true,
        data: {
          analysis,
          summary
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

module.exports = ProductController;

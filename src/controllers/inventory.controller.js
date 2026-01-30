const Ingredient = require('../models/Ingredient');
const Semifinished = require('../models/Semifinished');

class InventoryController {
  // Ingredients CRUD
  static async createIngredient(req, res) {
    try {
      const ingredientData = {
        ...req.body,
        restaurantId: req.user.restaurantId || req.body.restaurantId
      };

      const ingredient = new Ingredient(ingredientData);
      await ingredient.save();

      await ingredient.populate('supplierId', 'name phone email');

      res.status(201).json({
        success: true,
        data: ingredient
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'El ingrediente ya existe'
        });
      }
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async getIngredients(req, res) {
    try {
      const {
        page = 1,
        limit = 50,
        category,
        stockStatus,
        search
      } = req.query;

      const restaurantId = req.user.restaurantId || req.query.restaurantId;
      const filter = { restaurantId, isActive: true };

      if (category) filter.category = category;
      if (search) {
        filter.name = { $regex: search, $options: 'i' };
      }

      const ingredients = await Ingredient.find(filter)
        .populate('supplierId', 'name phone email')
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .sort({ name: 1 });

      // Apply stock status filter if needed
      let filteredIngredients = ingredients;
      if (stockStatus) {
        filteredIngredients = ingredients.filter(ing => {
          const status = ing.stockStatus;
          if (stockStatus === 'low') return status === 'STOCK BAJO';
          if (stockStatus === 'out') return status === 'SIN STOCK';
          if (stockStatus === 'ok') return status === 'OK';
          return true;
        });
      }

      const total = await Ingredient.countDocuments(filter);

      res.json({
        success: true,
        data: {
          ingredients: filteredIngredients,
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

  static async getIngredient(req, res) {
    try {
      const ingredient = await Ingredient.findOne({
        _id: req.params.id,
        restaurantId: req.user.restaurantId
      }).populate('supplierId', 'name phone email');

      if (!ingredient) {
        return res.status(404).json({
          success: false,
          message: 'Ingrediente no encontrado'
        });
      }

      res.json({
        success: true,
        data: ingredient
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async updateIngredient(req, res) {
    try {
      const ingredient = await Ingredient.findOneAndUpdate(
        {
          _id: req.params.id,
          restaurantId: req.user.restaurantId
        },
        req.body,
        { new: true, runValidators: true }
      ).populate('supplierId', 'name phone email');

      if (!ingredient) {
        return res.status(404).json({
          success: false,
          message: 'Ingrediente no encontrado'
        });
      }

      res.json({
        success: true,
        data: ingredient
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async getIngredientUsage(req, res) {
    try {
      const ingredientId = req.params.id;
      const restaurantId = req.user.restaurantId;

      // Find all recipes that use this ingredient
      const Recipe = require('../models/Recipe');
      const recipes = await Recipe.find({
        restaurantId,
        'recipeIngredients.ingredientId': ingredientId,
        isActive: true
      })
        .populate('recipeIngredients.ingredientId', 'name unit')
        .populate('name')
        .select('name description recipeIngredients');

      // Find all semifinished products that use this ingredient
      const Semifinished = require('../models/Semifinished');
      const semifinishedProducts = await Semifinished.find({
        restaurantId,
        'recipeIngredients.ingredientId': ingredientId,
        isActive: true
      })
        .populate('recipeIngredients.ingredientId', 'name unit')
        .populate('name')
        .select('name description recipeIngredients');

      const usage = {
        ingredientId,
        usedInRecipes: recipes.map(recipe => ({
          id: recipe._id,
          name: recipe.name,
          type: 'recipe',
          quantity: recipe.recipeIngredients.find(ri => ri.ingredientId.toString() === ingredientId)?.grossQuantity || 0,
          unit: recipe.recipeIngredients.find(ri => ri.ingredientId.toString() === ingredientId)?.ingredientId?.unit || 'unidad'
        })),
        usedInSemifinished: semifinishedProducts.map(product => ({
          id: product._id,
          name: product.name,
          type: 'semifinished',
          quantity: product.recipeIngredients.find(ri => ri.ingredientId.toString() === ingredientId)?.grossQuantity || 0,
          unit: product.recipeIngredients.find(ri => ri.ingredientId.toString() === ingredientId)?.ingredientId?.unit || 'unidad'
        }))
      };

      res.json({
        success: true,
        data: usage
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async deleteIngredient(req, res) {
    try {
      const ingredient = await Ingredient.findOneAndUpdate(
        {
          _id: req.params.id,
          restaurantId: req.user.restaurantId
        },
        { isActive: false },
        { new: true }
      );

      if (!ingredient) {
        return res.status(404).json({
          success: false,
          message: 'Ingrediente no encontrado'
        });
      }

      res.json({
        success: true,
        message: 'Ingrediente eliminado correctamente'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async updateStock(req, res) {
    try {
      const { quantity, operation = 'add' } = req.body;
      const ingredient = await Ingredient.findOne({
        _id: req.params.id,
        restaurantId: req.user.restaurantId
      });

      if (!ingredient) {
        return res.status(404).json({
          success: false,
          message: 'Ingrediente no encontrado'
        });
      }

      await ingredient.updateStock(quantity, operation);

      res.json({
        success: true,
        data: ingredient
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Semifinished CRUD
  static async createSemifinished(req, res) {
    try {
      const semifinishedData = {
        ...req.body,
        restaurantId: req.user.restaurantId || req.body.restaurantId
      };

      const semifinished = new Semifinished(semifinishedData);
      await semifinished.save();
      await semifinished.calculateCost();

      res.status(201).json({
        success: true,
        data: semifinished
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'El semielaborado ya existe'
        });
      }
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async getSemifinished(req, res) {
    try {
      const { page = 1, limit = 50, category, search } = req.query;
      const restaurantId = req.user.restaurantId || req.query.restaurantId;
      const filter = { restaurantId, isActive: true };

      if (category) filter.category = category;
      if (search) {
        filter.name = { $regex: search, $options: 'i' };
      }

      const semifinished = await Semifinished.find(filter)
        .populate('ingredients.ingredientId', 'name unit currentStock')
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .sort({ name: 1 });

      const total = await Semifinished.countDocuments(filter);

      res.json({
        success: true,
        data: {
          semifinished,
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

  static async getStockReport(req, res) {
    try {
      const restaurantId = req.user.restaurantId || req.query.restaurantId;
      
      const ingredients = await Ingredient.find({
        restaurantId,
        isActive: true
      }).populate('supplierId', 'name');

      const stockReport = {
        total: ingredients.length,
        outOfStock: ingredients.filter(i => i.currentStock <= 0).length,
        lowStock: ingredients.filter(i => i.currentStock <= i.minStock && i.currentStock > 0).length,
        normal: ingredients.filter(i => i.currentStock > i.minStock).length,
        totalValue: ingredients.reduce((sum, i) => sum + (i.currentStock * i.unitCost), 0),
        ingredients: ingredients.map(i => ({
          id: i._id,
          name: i.name,
          currentStock: i.currentStock,
          minStock: i.minStock,
          unit: i.unit,
          unitCost: i.unitCost,
          totalValue: i.currentStock * i.unitCost,
          status: i.stockStatus,
          supplier: i.supplierId?.name || 'N/A'
        }))
      };

      res.json({
        success: true,
        data: stockReport
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = InventoryController;

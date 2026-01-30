const Recipe = require('../models/Recipe');
const Ingredient = require('../models/Ingredient');
const Semifinished = require('../models/Semifinished');

class RecipeController {
  static async createRecipe(req, res) {
    try {
      const recipeData = {
        ...req.body,
        restaurantId: req.user.restaurantId || req.body.restaurantId
      };

      const recipe = new Recipe(recipeData);
      await recipe.save();
      await recipe.calculateCost();

      await recipe.populate([
        {
          path: 'ingredients.ingredientId',
          select: 'name unit unitCost currentStock'
        },
        {
          path: 'semifinishedItems.semifinishedId',
          select: 'name unitCost'
        }
      ]);

      res.status(201).json({
        success: true,
        data: recipe
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'La receta ya existe'
        });
      }
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async getRecipes(req, res) {
    try {
      const {
        page = 1,
        limit = 50,
        category,
        search,
        minProfit,
        maxProfit
      } = req.query;

      const restaurantId = req.user.restaurantId || req.query.restaurantId;
      const filter = { restaurantId, isActive: true };

      if (category) filter.category = category;
      if (search) {
        filter.name = { $regex: search, $options: 'i' };
      }

      const recipes = await Recipe.find(filter)
        .populate('ingredients.ingredientId', 'name unit unitCost currentStock')
        .populate('semifinishedItems.semifinishedId', 'name unitCost')
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .sort({ name: 1 });

      // Apply profit filters if needed
      let filteredRecipes = recipes;
      if (minProfit || maxProfit) {
        filteredRecipes = recipes.filter(recipe => {
          const profitPercentage = recipe.profitPercentage;
          if (minProfit && profitPercentage < parseFloat(minProfit)) return false;
          if (maxProfit && profitPercentage > parseFloat(maxProfit)) return false;
          return true;
        });
      }

      const total = await Recipe.countDocuments(filter);

      res.json({
        success: true,
        data: {
          recipes: filteredRecipes,
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

  static async getRecipe(req, res) {
    try {
      const recipe = await Recipe.findOne({
        _id: req.params.id,
        restaurantId: req.user.restaurantId
      })
        .populate('ingredients.ingredientId', 'name unit unitCost currentStock')
        .populate('semifinishedItems.semifinishedId', 'name unitCost ingredients');

      if (!recipe) {
        return res.status(404).json({
          success: false,
          message: 'Receta no encontrada'
        });
      }

      res.json({
        success: true,
        data: recipe
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async updateRecipe(req, res) {
    try {
      const recipe = await Recipe.findOneAndUpdate(
        {
          _id: req.params.id,
          restaurantId: req.user.restaurantId
        },
        req.body,
        { new: true, runValidators: true }
      );

      if (!recipe) {
        return res.status(404).json({
          success: false,
          message: 'Receta no encontrada'
        });
      }

      await recipe.calculateCost();
      await recipe.populate([
        {
          path: 'ingredients.ingredientId',
          select: 'name unit unitCost currentStock'
        },
        {
          path: 'semifinishedItems.semifinishedId',
          select: 'name unitCost'
        }
      ]);

      res.json({
        success: true,
        data: recipe
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async deleteRecipe(req, res) {
    try {
      const recipe = await Recipe.findOneAndUpdate(
        {
          _id: req.params.id,
          restaurantId: req.user.restaurantId
        },
        { isActive: false },
        { new: true }
      );

      if (!recipe) {
        return res.status(404).json({
          success: false,
          message: 'Receta no encontrada'
        });
      }

      res.json({
        success: true,
        message: 'Receta eliminada correctamente'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async calculateRecipeCost(req, res) {
    try {
      const recipe = await Recipe.findOne({
        _id: req.params.id,
        restaurantId: req.user.restaurantId
      });

      if (!recipe) {
        return res.status(404).json({
          success: false,
          message: 'Receta no encontrada'
        });
      }

      await recipe.calculateCost();
      await recipe.populate([
        {
          path: 'ingredients.ingredientId',
          select: 'name unit unitCost currentStock'
        },
        {
          path: 'semifinishedItems.semifinishedId',
          select: 'name unitCost'
        }
      ]);

      res.json({
        success: true,
        data: {
          recipeId: recipe._id,
          calculatedCost: recipe.calculatedCost,
          lastCostCalculation: recipe.lastCostCalculation,
          profit: recipe.profit,
          profitPercentage: recipe.profitPercentage
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
      const restaurantId = req.user.restaurantId || req.query.restaurantId;
      
      const recipes = await Recipe.find({
        restaurantId,
        isActive: true
      })
        .populate('ingredients.ingredientId', 'name unit unitCost currentStock')
        .populate('semifinishedItems.semifinishedId', 'name unitCost');

      const analysis = {
        totalRecipes: recipes.length,
        avgCost: recipes.reduce((sum, r) => sum + r.calculatedCost, 0) / recipes.length,
        avgPrice: recipes.reduce((sum, r) => sum + (r.sellingPrice || 0), 0) / recipes.length,
        avgProfitMargin: recipes.reduce((sum, r) => sum + (r.profitMargin || 0), 0) / recipes.length,
        recipes: recipes.map(r => ({
          id: r._id,
          name: r.name,
          category: r.category,
          calculatedCost: r.calculatedCost,
          sellingPrice: r.sellingPrice,
          profit: r.profit,
          profitMargin: r.profitMargin,
          profitPercentage: r.profitPercentage,
          ingredientCount: r.ingredients.length + r.semifinishedItems.length
        }))
      };

      res.json({
        success: true,
        data: analysis
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
      const { sellingPrice } = req.body;
      
      const recipe = await Recipe.findOneAndUpdate(
        {
          _id: req.params.id,
          restaurantId: req.user.restaurantId
        },
        { sellingPrice },
        { new: true, runValidators: true }
      );

      if (!recipe) {
        return res.status(404).json({
          success: false,
          message: 'Receta no encontrada'
        });
      }

      // Recalculate profit margin
      recipe.profitMargin = ((sellingPrice - recipe.calculatedCost) / sellingPrice) * 100;
      await recipe.save();

      res.json({
        success: true,
        data: {
          sellingPrice: recipe.sellingPrice,
          profitMargin: recipe.profitMargin,
          profit: recipe.profit,
          profitPercentage: recipe.profitPercentage
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

module.exports = RecipeController;

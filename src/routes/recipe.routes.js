const express = require('express');
const RecipeController = require('../controllers/recipe.controller');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

// Recipe CRUD routes
router.post('/recipes', 
  authenticateToken, 
  requireRole(['admin']), 
  RecipeController.createRecipe
);

router.get('/recipes', 
  authenticateToken, 
  RecipeController.getRecipes
);

router.get('/recipes/:id', 
  authenticateToken, 
  RecipeController.getRecipe
);

router.put('/recipes/:id', 
  authenticateToken, 
  requireRole(['admin']), 
  RecipeController.updateRecipe
);

router.delete('/recipes/:id', 
  authenticateToken, 
  requireRole(['admin']), 
  RecipeController.deleteRecipe
);

// Recipe cost analysis routes
router.post('/recipes/:id/calculate-cost', 
  authenticateToken, 
  requireRole(['admin']), 
  RecipeController.calculateRecipeCost
);

router.put('/recipes/:id/price', 
  authenticateToken, 
  requireRole(['admin']), 
  RecipeController.updateSellingPrice
);

router.get('/recipes/cost-analysis', 
  authenticateToken, 
  RecipeController.getRecipeCostAnalysis
);

module.exports = router;

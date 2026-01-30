const Client = require('../models/Client');

class ClientsController {
  static async createClient(req, res) {
    try {
      const clientData = {
        ...req.body,
        restaurantId: req.user.restaurantId || req.body.restaurantId
      };

      const client = new Client(clientData);
      await client.save();

      res.status(201).json({
        success: true,
        data: client
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async getClients(req, res) {
    try {
      const { page = 1, limit = 10, offset = 0, search } = req.query;
      const restaurantId = req.user.restaurantId || req.query.restaurantId;
      const filter = { restaurantId, isActive: true };

      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ];
      }

      const clients = await Client.find(filter)
        .limit(parseInt(limit))
        .skip(parseInt(offset))
        .sort({ name: 1 });

      const total = await Client.countDocuments(filter);

      res.json({
        success: true,
        data: {
          clients,
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

  static async getClient(req, res) {
    try {
      const client = await Client.findOne({
        _id: req.params.id,
        restaurantId: req.user.restaurantId
      });

      if (!client) {
        return res.status(404).json({
          success: false,
          message: 'Cliente no encontrado'
        });
      }

      res.json({
        success: true,
        data: client
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async updateClient(req, res) {
    try {
      const client = await Client.findOneAndUpdate(
        {
          _id: req.params.id,
          restaurantId: req.user.restaurantId
        },
        req.body,
        { new: true, runValidators: true }
      );

      if (!client) {
        return res.status(404).json({
          success: false,
          message: 'Cliente no encontrado'
        });
      }

      res.json({
        success: true,
        data: client
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async deleteClient(req, res) {
    try {
      const client = await Client.findOneAndUpdate(
        {
          _id: req.params.id,
          restaurantId: req.user.restaurantId
        },
        { isActive: false },
        { new: true }
      );

      if (!client) {
        return res.status(404).json({
          success: false,
          message: 'Cliente no encontrado'
        });
      }

      res.json({
        success: true,
        message: 'Cliente eliminado correctamente'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = ClientsController;

const { User, Message } = require("../models");
const { Op } = require("sequelize");

const hasShopActivity = async (userId, shopId) => {
  const messageCount = await Message.count({ where: { UserId: userId, ShopId: shopId } });
  return messageCount > 0;
};

exports.getAllCustomers = async (req, res) => {
  try {
    const { search, role, sortBy = "createdAt", order = "DESC" } = req.query;
    const where = {};

    if (search) {
      where[Op.or] = [{ name: { [Op.iLike]: `%${search}%` } }, { email: { [Op.iLike]: `%${search}%` } }];
    }
    if (role) {
      where.role = role;
    }

    const customers = await User.findAll({
      where,
      attributes: { exclude: ["password"] },
      order: [[sortBy, String(order).toUpperCase()]],
    });

    const customersWithStats = await Promise.all(
      customers.map(async (customer) => {
        const messageCount = await Message.count({ where: { UserId: customer.id, ShopId: req.shopId } });
        return {
          ...customer.toJSON(),
          stats: {
            orderCount: 0,
            totalSpent: 0,
            messageCount,
            lastOrderDate: null,
          },
        };
      })
    );

    return res.json(customersWithStats);
  } catch (error) {
    console.error("Error fetching customers:", error);
    return res.status(500).json({ error: "Failed to fetch customers" });
  }
};

exports.getCustomerById = async (req, res) => {
  try {
    const customer = await User.findByPk(req.params.id, { attributes: { exclude: ["password"] } });
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const inCurrentShop = await hasShopActivity(customer.id, req.shopId);
    if (!inCurrentShop) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const messages = await Message.findAll({
      where: { UserId: customer.id, ShopId: req.shopId },
      order: [["createdAt", "DESC"]],
      limit: 10,
    });

    return res.json({
      customer: customer.toJSON(),
      orders: [],
      messages,
      stats: {
        orderCount: 0,
        totalSpent: 0,
        avgOrderValue: 0,
        messageCount: messages.length,
      },
    });
  } catch (error) {
    console.error("Error fetching customer:", error);
    return res.status(500).json({ error: "Failed to fetch customer details" });
  }
};

exports.updateCustomer = async (req, res) => {
  try {
    const customer = await User.findByPk(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const inCurrentShop = await hasShopActivity(customer.id, req.shopId);
    if (!inCurrentShop) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const { role, name } = req.body;
    if (role && !["customer", "admin"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    await customer.update({ role: role || customer.role, name: name || customer.name });
    const updated = customer.toJSON();
    delete updated.password;
    return res.json(updated);
  } catch (error) {
    console.error("Error updating customer:", error);
    return res.status(500).json({ error: "Failed to update customer" });
  }
};

exports.deleteCustomer = async (req, res) => {
  try {
    const customer = await User.findByPk(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const inCurrentShop = await hasShopActivity(customer.id, req.shopId);
    if (!inCurrentShop) {
      return res.status(404).json({ error: "Customer not found" });
    }

    await customer.destroy();
    return res.json({ message: "Customer deleted successfully" });
  } catch (error) {
    console.error("Error deleting customer:", error);
    return res.status(500).json({ error: "Failed to delete customer" });
  }
};

exports.getCustomerStats = async (req, res) => {
  try {
    const [adminCount, customerCount, newThisMonth] = await Promise.all([
      User.count({ where: { role: "admin" } }),
      User.count({ where: { role: "customer" } }),
      User.count({
        where: {
          createdAt: {
            [Op.gte]: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }),
    ]);

    return res.json({
      total: customerCount,
      admins: adminCount,
      customers: customerCount,
      newThisMonth,
      topCustomers: [],
    });
  } catch (error) {
    console.error("Error fetching customer stats:", error);
    return res.status(500).json({ error: "Failed to fetch customer statistics" });
  }
};

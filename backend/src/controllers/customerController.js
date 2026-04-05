const { User, Order, OrderItem, Product, Message } = require("../models");
const { Op } = require("sequelize");
const { ensureMinorInt, minorToMajor } = require("../utils/money");

const hasShopActivity = async (userId, shopId) => {
  const [orderCount, messageCount] = await Promise.all([
    Order.count({ where: { UserId: userId, ShopId: shopId } }),
    Message.count({ where: { UserId: userId, ShopId: shopId } }),
  ]);

  return orderCount + messageCount > 0;
};

// Get all customers with statistics
exports.getAllCustomers = async (req, res) => {
  try {
    const { search, role, sortBy = "createdAt", order = "DESC" } = req.query;
    const where = {};

    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
      ];
    }

    if (role) {
      where.role = role;
    }

    const customers = await User.findAll({
      where,
      attributes: {
        exclude: ["password"],
      },
      include: [
        {
          model: Order,
          where: { ShopId: req.shopId },
          attributes: [],
          required: true,
        },
      ],
      group: ["User.id"],
      order: [[sortBy, order.toUpperCase()]],
    });

    // Get statistics for each customer
    const customersWithStats = await Promise.all(
      customers.map(async (customer) => {
        const [orderCount, totalSpent, messageCount] = await Promise.all([
          Order.count({ where: { UserId: customer.id, ShopId: req.shopId } }),
          Order.sum("totalMinor", { where: { UserId: customer.id, ShopId: req.shopId } }),
          Message.count({ where: { UserId: customer.id, ShopId: req.shopId } }),
        ]);

        const lastOrder = await Order.findOne({
          where: { UserId: customer.id, ShopId: req.shopId },
          order: [["createdAt", "DESC"]],
          attributes: ["createdAt"],
        });

        return {
          ...customer.toJSON(),
          stats: {
            orderCount: orderCount || 0,
            totalSpent: minorToMajor(ensureMinorInt(totalSpent || 0)),
            messageCount: messageCount || 0,
            lastOrderDate: lastOrder ? lastOrder.createdAt : null,
          },
        };
      })
    );

    res.json(customersWithStats);
  } catch (error) {
    console.error("Error fetching customers:", error);
    res.status(500).json({ error: "Failed to fetch customers" });
  }
};

// Get single customer with detailed information
exports.getCustomerById = async (req, res) => {
  try {
    const customer = await User.findByPk(req.params.id, {
      attributes: {
        exclude: ["password"],
      },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const inCurrentShop = await hasShopActivity(customer.id, req.shopId);

    if (!inCurrentShop) {
      return res.status(404).json({ error: "Customer not found" });
    }

    // Get customer's orders with items
    const orders = await Order.findAll({
      where: { UserId: customer.id, ShopId: req.shopId },
      include: [
        {
          model: OrderItem,
          attributes: ["id", "quantity", "unitPrice"],
          include: [
            {
              model: Product,
              attributes: ["id", "name", "imageUrl"],
            },
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    // Get customer's messages
    const messages = await Message.findAll({
      where: { UserId: customer.id, ShopId: req.shopId },
      order: [["createdAt", "DESC"]],
      limit: 10,
    });

    // Calculate statistics
    const [orderCount, totalSpent, messageCount] = await Promise.all([
      Order.count({ where: { UserId: customer.id, ShopId: req.shopId } }),
      Order.sum("totalMinor", { where: { UserId: customer.id, ShopId: req.shopId } }),
      Message.count({ where: { UserId: customer.id, ShopId: req.shopId } }),
    ]);

    const totalSpentMajor = minorToMajor(ensureMinorInt(totalSpent || 0));
    const avgOrderValue = orderCount > 0 ? totalSpentMajor / orderCount : 0;

    res.json({
      customer: customer.toJSON(),
      orders,
      messages,
      stats: {
        orderCount: orderCount || 0,
        totalSpent: totalSpentMajor,
        avgOrderValue: avgOrderValue || 0,
        messageCount: messageCount || 0,
      },
    });
  } catch (error) {
    console.error("Error fetching customer:", error);
    res.status(500).json({ error: "Failed to fetch customer details" });
  }
};

// Update customer role or other details (admin only)
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

    // Validate role
    if (role && !["customer", "admin"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    await customer.update({
      role: role || customer.role,
      name: name || customer.name,
    });

    const updatedCustomer = customer.toJSON();
    delete updatedCustomer.password;

    res.json(updatedCustomer);
  } catch (error) {
    console.error("Error updating customer:", error);
    res.status(500).json({ error: "Failed to update customer" });
  }
};

// Delete customer (admin only)
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

    // Check if customer has orders
    const orderCount = await Order.count({ where: { UserId: customer.id, ShopId: req.shopId } });

    if (orderCount > 0) {
      return res.status(400).json({
        error:
          "Cannot delete customer with existing orders. Consider deactivating instead.",
      });
    }

    await customer.destroy();
    res.json({ message: "Customer deleted successfully" });
  } catch (error) {
    console.error("Error deleting customer:", error);
    res.status(500).json({ error: "Failed to delete customer" });
  }
};

// Get customer statistics overview
exports.getCustomerStats = async (req, res) => {
  try {
    const [totalCustomers, adminCount, customerCount, newThisMonth] =
      await Promise.all([
        Order.count({ where: { ShopId: req.shopId, distinct: true, col: "UserId" } }),
        User.count({ where: { role: "admin" } }),
        User.count({ where: { role: "customer" } }),
        User.count({
          where: {
            createdAt: {
              [Op.gte]: new Date(
                new Date().getFullYear(),
                new Date().getMonth(),
                1
              ),
            },
          },
        }),
      ]);

    // Get customers with most orders
    const topCustomers = await Order.findAll({
      where: { ShopId: req.shopId },
      attributes: [
        "UserId",
        [
          User.sequelize.fn("COUNT", User.sequelize.col("Order.id")),
          "orderCount",
        ],
        [
          User.sequelize.fn("SUM", User.sequelize.col("Order.totalMinor")),
          "totalSpent",
        ],
      ],
      include: [
        {
          model: User,
          attributes: ["id", "name", "email"],
        },
      ],
      group: ["UserId", "User.id"],
      order: [[User.sequelize.literal("totalSpent"), "DESC"]],
      limit: 5,
    });

    const normalizedTopCustomers = topCustomers.map((entry) => {
      const data = entry.toJSON ? entry.toJSON() : entry;
      return {
        ...data,
        totalSpent: minorToMajor(ensureMinorInt(data.totalSpent || 0)),
      };
    });

    res.json({
      total: totalCustomers,
      admins: adminCount,
      customers: customerCount,
      newThisMonth,
      topCustomers: normalizedTopCustomers,
    });
  } catch (error) {
    console.error("Error fetching customer stats:", error);
    res.status(500).json({ error: "Failed to fetch customer statistics" });
  }
};

const { Coupon, Order } = require("../models");
const { Op } = require("sequelize");

// Get all coupons (admin)
exports.getAllCoupons = async (req, res) => {
  try {
    const { status, type, search } = req.query;
    const where = { ShopId: req.shopId };

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    if (search) {
      where.code = { [Op.iLike]: `%${search}%` };
    }

    const coupons = await Coupon.findAll({
      where,
      order: [["createdAt", "DESC"]],
    });

    res.json(coupons);
  } catch (error) {
    console.error("Error fetching coupons:", error);
    res.status(500).json({ error: "Failed to fetch coupons" });
  }
};

// Get single coupon by ID (admin)
exports.getCouponById = async (req, res) => {
  try {
    const coupon = await Coupon.findOne({
      where: { id: req.params.id, ShopId: req.shopId },
      include: [
        {
          model: Order,
          attributes: ["id", "total", "createdAt"],
          where: { ShopId: req.shopId },
          limit: 10,
          order: [["createdAt", "DESC"]],
        },
      ],
    });

    if (!coupon) {
      return res.status(404).json({ error: "Coupon not found" });
    }

    res.json(coupon);
  } catch (error) {
    console.error("Error fetching coupon:", error);
    res.status(500).json({ error: "Failed to fetch coupon" });
  }
};

// Create new coupon (admin)
exports.createCoupon = async (req, res) => {
  try {
    const {
      code,
      type,
      value,
      minPurchase,
      maxDiscount,
      usageLimit,
      startDate,
      endDate,
    } = req.body;

    // Validate required fields
    if (!code || !type || !value) {
      return res
        .status(400)
        .json({ error: "Code, type, and value are required" });
    }

    // Check if code already exists
    const existingCoupon = await Coupon.findOne({ where: { code, ShopId: req.shopId } });
    if (existingCoupon) {
      return res.status(400).json({ error: "Coupon code already exists" });
    }

    // Validate coupon type
    if (type === "percentage" && (value < 0 || value > 100)) {
      return res
        .status(400)
        .json({ error: "Percentage value must be between 0 and 100" });
    }

    if (type === "fixed" && value < 0) {
      return res
        .status(400)
        .json({ error: "Fixed value must be greater than 0" });
    }

    // Validate dates
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return res
        .status(400)
        .json({ error: "Start date must be before end date" });
    }

    const coupon = await Coupon.create({
      ShopId: req.shopId,
      code: code.toUpperCase(),
      type,
      value,
      minPurchase: minPurchase || 0,
      maxDiscount: maxDiscount || null,
      usageLimit: usageLimit || null,
      usageCount: 0,
      status: "active",
      startDate: startDate || null,
      endDate: endDate || null,
    });

    res.status(201).json(coupon);
  } catch (error) {
    console.error("Error creating coupon:", error);
    res.status(500).json({ error: "Failed to create coupon" });
  }
};

// Update coupon (admin)
exports.updateCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findOne({ where: { id: req.params.id, ShopId: req.shopId } });

    if (!coupon) {
      return res.status(404).json({ error: "Coupon not found" });
    }

    const {
      code,
      type,
      value,
      minPurchase,
      maxDiscount,
      usageLimit,
      status,
      startDate,
      endDate,
    } = req.body;

    // If code is being changed, check uniqueness
    if (code && code !== coupon.code) {
      const existingCoupon = await Coupon.findOne({ where: { code, ShopId: req.shopId } });
      if (existingCoupon) {
        return res.status(400).json({ error: "Coupon code already exists" });
      }
    }

    // Validate type and value if being updated
    if (type && value !== undefined) {
      if (type === "percentage" && (value < 0 || value > 100)) {
        return res
          .status(400)
          .json({ error: "Percentage value must be between 0 and 100" });
      }

      if (type === "fixed" && value < 0) {
        return res
          .status(400)
          .json({ error: "Fixed value must be greater than 0" });
      }
    }

    // Validate dates if being updated
    const newStartDate = startDate || coupon.startDate;
    const newEndDate = endDate || coupon.endDate;
    if (
      newStartDate &&
      newEndDate &&
      new Date(newStartDate) > new Date(newEndDate)
    ) {
      return res
        .status(400)
        .json({ error: "Start date must be before end date" });
    }

    await coupon.update({
      code: code ? code.toUpperCase() : coupon.code,
      type: type || coupon.type,
      value: value !== undefined ? value : coupon.value,
      minPurchase:
        minPurchase !== undefined ? minPurchase : coupon.minPurchase,
      maxDiscount:
        maxDiscount !== undefined ? maxDiscount : coupon.maxDiscount,
      usageLimit: usageLimit !== undefined ? usageLimit : coupon.usageLimit,
      status: status || coupon.status,
      startDate: startDate !== undefined ? startDate : coupon.startDate,
      endDate: endDate !== undefined ? endDate : coupon.endDate,
    });

    res.json(coupon);
  } catch (error) {
    console.error("Error updating coupon:", error);
    res.status(500).json({ error: "Failed to update coupon" });
  }
};

// Delete coupon (admin)
exports.deleteCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findOne({ where: { id: req.params.id, ShopId: req.shopId } });

    if (!coupon) {
      return res.status(404).json({ error: "Coupon not found" });
    }

    // Check if coupon has been used
    const usedCount = await Order.count({
      where: { CouponId: coupon.id, ShopId: req.shopId },
    });

    if (usedCount > 0) {
      // Don't delete if used, just deactivate
      await coupon.update({ status: "inactive" });
      return res.json({
        message: "Coupon deactivated (has been used in orders)",
        coupon,
      });
    }

    await coupon.destroy();
    res.json({ message: "Coupon deleted successfully" });
  } catch (error) {
    console.error("Error deleting coupon:", error);
    res.status(500).json({ error: "Failed to delete coupon" });
  }
};

// Validate and apply coupon (user)
exports.validateCoupon = async (req, res) => {
  try {
    const { code, orderAmount } = req.body;

    if (!code || !orderAmount) {
      return res
        .status(400)
        .json({ error: "Coupon code and order amount are required" });
    }

    const coupon = await Coupon.findOne({
      where: { code: code.toUpperCase(), ShopId: req.shopId },
    });

    if (!coupon) {
      return res.status(404).json({ error: "Invalid coupon code" });
    }

    // Check coupon status
    if (coupon.status !== "active") {
      return res.status(400).json({ error: "Coupon is not active" });
    }

    if (!req.shopConfig?.features?.couponsEnabled) {
      return res.status(400).json({ error: "Coupons are disabled for this shop" });
    }

    // Check date validity
    const now = new Date();
    if (coupon.startDate && new Date(coupon.startDate) > now) {
      return res
        .status(400)
        .json({ error: "Coupon is not yet valid" });
    }

    if (coupon.endDate && new Date(coupon.endDate) < now) {
      return res.status(400).json({ error: "Coupon has expired" });
    }

    // Check usage limit
    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      return res
        .status(400)
        .json({ error: "Coupon usage limit reached" });
    }

    // Check minimum purchase
    if (coupon.minPurchase && orderAmount < coupon.minPurchase) {
      return res.status(400).json({
        error: `Minimum purchase amount of ${req.shopConfig?.branding?.currency || "GHS"} ${coupon.minPurchase} required`,
      });
    }

    // Calculate discount in minor units to avoid floating-point rounding
    const orderAmountMinor = Math.round(orderAmount * 100);
    let discountMinor = 0;
    if (coupon.type === "percentage") {
      // percentageBasisPoints: coupon.value as percentage (e.g., 10 for 10%)
      const percentageBasisPoints = Math.round(coupon.value * 100);
      discountMinor = Math.floor((orderAmountMinor * percentageBasisPoints) / 10000);
      if (coupon.maxDiscount) {
        const maxDiscountMinor = Math.round(coupon.maxDiscount * 100);
        if (discountMinor > maxDiscountMinor) {
          discountMinor = maxDiscountMinor;
        }
      }
    } else if (coupon.type === "fixed") {
      discountMinor = Math.round(coupon.value * 100);
    }

    // Ensure discount doesn't exceed order amount
    discountMinor = Math.min(discountMinor, orderAmountMinor);
    const finalAmountMinor = orderAmountMinor - discountMinor;

    res.json({
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
      },
      discount: (discountMinor / 100).toFixed(2),
      finalAmount: (finalAmountMinor / 100).toFixed(2),
    });
  } catch (error) {
    console.error("Error validating coupon:", error);
    res.status(500).json({ error: "Failed to validate coupon" });
  }
};

require("../config/env");
const { sequelize, Shop, Category, Product } = require("../models");

const categories = [
  { name: "Essentials", slug: "essentials" },
  { name: "Wellness", slug: "wellness" },
  { name: "Home", slug: "home" },
  { name: "Stationery", slug: "stationery" },
];

const products = [
  {
    name: "Atlas Travel Pack",
    slug: "atlas-travel-pack",
    description: "A modular travel pack with weatherproof materials.",
    price: 148,
    sku: "ATL-TRVL-01",
    stock: 32,
    status: "active",
    categorySlug: "essentials",
  },
  {
    name: "Studio Scent Kit",
    slug: "studio-scent-kit",
    description: "Four signature scents designed for focused work sessions.",
    price: 68,
    sku: "STU-SCNT-02",
    stock: 18,
    status: "active",
    categorySlug: "wellness",
  },
  {
    name: "Arden Desk Lamp",
    slug: "arden-desk-lamp",
    description: "Soft ambient lighting with adjustable warmth control.",
    price: 124,
    sku: "ARD-LAMP-04",
    stock: 6,
    status: "active",
    categorySlug: "home",
  },
  {
    name: "Field Journal Set",
    slug: "field-journal-set",
    description: "Three premium notebooks with recycled paper stock.",
    price: 42,
    sku: "FLD-JRNL-05",
    stock: 40,
    status: "active",
    categorySlug: "stationery",
  },
  {
    name: "Signal Key Tray",
    slug: "signal-key-tray",
    description: "Minimalist tray for everyday carry essentials.",
    price: 38,
    sku: "SIG-TRAY-06",
    stock: 22,
    status: "active",
    categorySlug: "home",
  },
  {
    name: "Calm Focus Mist",
    slug: "calm-focus-mist",
    description: "Aromatherapy mist with bergamot and cedar notes.",
    price: 32,
    sku: "CLM-MIST-07",
    stock: 28,
    status: "active",
    categorySlug: "wellness",
  },
];

const seed = async () => {
  const transaction = await sequelize.transaction();
  try {
    const targetShopSlug = process.env.SEED_SHOP_SLUG || "main-shop";
    const shop = await Shop.findOne({
      where: { slug: targetShopSlug },
      transaction,
    });

    if (!shop) {
      throw new Error(`Shop not found for seeding: ${targetShopSlug}`);
    }

    const categoryMap = new Map();

    for (const category of categories) {
      const [record] = await Category.findOrCreate({
        where: { slug: category.slug, ShopId: shop.id },
        defaults: { ...category, ShopId: shop.id },
        transaction,
      });
      categoryMap.set(category.slug, record);
    }

    for (const product of products) {
      const category = categoryMap.get(product.categorySlug);
      if (!category) {
        throw new Error(`Missing category ${product.categorySlug}`);
      }

      await Product.findOrCreate({
        where: { slug: product.slug, ShopId: shop.id },
        defaults: {
          ShopId: shop.id,
          name: product.name,
          slug: product.slug,
          description: product.description,
          price: product.price,
          sku: product.sku,
          stock: product.stock,
          status: product.status,
          CategoryId: category.id,
        },
        transaction,
      });
    }

    await transaction.commit();
    // eslint-disable-next-line no-console
    console.log("Catalog seed complete.");
    process.exit(0);
  } catch (error) {
    await transaction.rollback();
    // eslint-disable-next-line no-console
    console.error("Catalog seed failed", error);
    process.exit(1);
  }
};

seed();

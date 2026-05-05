const sequelize = require("../config/database");
const createUser = require("./User");
const createShop = require("./Shop");
const createUserShop = require("./UserShop");
const createCategory = require("./Category");
const createProduct = require("./Product");
const createProductVariant = require("./ProductVariant");
const createCategoryVariantTemplate = require("./CategoryVariantTemplate");
const createOfflineSale = require("./OfflineSale");
const createOfflineSaleItem = require("./OfflineSaleItem");
const createInventoryMovement = require("./InventoryMovement");
const createInventoryLot = require("./InventoryLot");
const createOfflineSaleItemLotAllocation = require("./OfflineSaleItemLotAllocation");
const createStockRequest = require("./StockRequest");

const User = createUser(sequelize);
const Shop = createShop(sequelize);
const UserShop = createUserShop(sequelize);
const Category = createCategory(sequelize);
const Product = createProduct(sequelize);
const ProductVariant = createProductVariant(sequelize);
const CategoryVariantTemplate = createCategoryVariantTemplate(sequelize);
const OfflineSale = createOfflineSale(sequelize);
const OfflineSaleItem = createOfflineSaleItem(sequelize);
const InventoryMovement = createInventoryMovement(sequelize);
const InventoryLot = createInventoryLot(sequelize);
const OfflineSaleItemLotAllocation = createOfflineSaleItemLotAllocation(sequelize);
const StockRequest = createStockRequest(sequelize);

User.hasMany(Shop, { foreignKey: "ownerId", as: "OwnedShops" });
Shop.belongsTo(User, { foreignKey: "ownerId", as: "Owner" });

User.belongsToMany(Shop, {
  through: UserShop,
  foreignKey: "UserId",
  otherKey: "ShopId",
  as: "Shops",
});
Shop.belongsToMany(User, {
  through: UserShop,
  foreignKey: "ShopId",
  otherKey: "UserId",
  as: "Users",
});
User.hasMany(UserShop, { foreignKey: "UserId" });
UserShop.belongsTo(User, { foreignKey: "UserId" });
Shop.hasMany(UserShop, { foreignKey: "ShopId" });
UserShop.belongsTo(Shop, { foreignKey: "ShopId" });

Shop.hasMany(Category, { foreignKey: { allowNull: false } });
Category.belongsTo(Shop);

Shop.hasMany(Product, { foreignKey: { allowNull: false } });
Product.belongsTo(Shop);

Shop.hasMany(ProductVariant, { foreignKey: { allowNull: false } });
ProductVariant.belongsTo(Shop);

Shop.hasMany(OfflineSale, { foreignKey: { allowNull: false } });
OfflineSale.belongsTo(Shop);

User.hasMany(OfflineSale, { foreignKey: { allowNull: false } });
OfflineSale.belongsTo(User);

OfflineSale.hasMany(OfflineSaleItem, {
  foreignKey: { allowNull: false },
  onDelete: "CASCADE",
});
OfflineSaleItem.belongsTo(OfflineSale);

Product.hasMany(OfflineSaleItem, { foreignKey: { allowNull: false } });
OfflineSaleItem.belongsTo(Product);

Shop.hasMany(InventoryMovement, { foreignKey: { allowNull: false } });
InventoryMovement.belongsTo(Shop);

Product.hasMany(InventoryMovement, { foreignKey: { allowNull: false } });
InventoryMovement.belongsTo(Product);

ProductVariant.hasMany(InventoryMovement, { foreignKey: { allowNull: true } });
InventoryMovement.belongsTo(ProductVariant);

User.hasMany(InventoryMovement, {
  foreignKey: "CreatedByUserId",
  as: "InventoryMovementsCreated",
});
InventoryMovement.belongsTo(User, {
  foreignKey: "CreatedByUserId",
  as: "CreatedBy",
});

Shop.hasMany(InventoryLot, { foreignKey: { allowNull: false } });
InventoryLot.belongsTo(Shop);

Product.hasMany(InventoryLot, { foreignKey: { allowNull: false } });
InventoryLot.belongsTo(Product);

ProductVariant.hasMany(InventoryLot, { foreignKey: { allowNull: true } });
InventoryLot.belongsTo(ProductVariant);

User.hasMany(InventoryLot, {
  foreignKey: "CreatedByUserId",
  as: "InventoryLotsCreated",
});
InventoryLot.belongsTo(User, {
  foreignKey: "CreatedByUserId",
  as: "CreatedBy",
});

OfflineSaleItem.hasMany(OfflineSaleItemLotAllocation, {
  foreignKey: { allowNull: false },
  onDelete: "CASCADE",
});
OfflineSaleItemLotAllocation.belongsTo(OfflineSaleItem);

InventoryLot.hasMany(OfflineSaleItemLotAllocation, {
  foreignKey: { allowNull: false },
  onDelete: "RESTRICT",
});
OfflineSaleItemLotAllocation.belongsTo(InventoryLot);


Category.hasMany(Product, { foreignKey: { allowNull: false } });
Product.belongsTo(Category);

Category.hasMany(Category, {
  as: "Children",
  foreignKey: "ParentId",
  onDelete: "SET NULL",
});
Category.belongsTo(Category, {
  as: "Parent",
  foreignKey: "ParentId",
});

Category.hasOne(CategoryVariantTemplate, { onDelete: "CASCADE" });
CategoryVariantTemplate.belongsTo(Category);

Product.hasMany(ProductVariant, {
  foreignKey: { allowNull: false },
  onDelete: "CASCADE",
});
ProductVariant.belongsTo(Product);

Shop.hasMany(StockRequest, { foreignKey: { allowNull: false } });
StockRequest.belongsTo(Shop);

Product.hasMany(StockRequest, { foreignKey: { allowNull: false } });
StockRequest.belongsTo(Product);

User.hasMany(StockRequest, {
  foreignKey: "RequesterId",
  as: "StockRequestsCreated",
});
StockRequest.belongsTo(User, {
  foreignKey: "RequesterId",
  as: "Requester",
});

User.hasMany(StockRequest, {
  foreignKey: "approvedBy",
  as: "StockRequestsApproved",
});
StockRequest.belongsTo(User, {
  foreignKey: "approvedBy",
  as: "Approver",
});

module.exports = {
  sequelize,
  User,
  Shop,
  UserShop,
  Category,
  Product,
  ProductVariant,
  CategoryVariantTemplate,
  OfflineSale,
  OfflineSaleItem,
  InventoryMovement,
  InventoryLot,
  OfflineSaleItemLotAllocation,
  StockRequest,
};

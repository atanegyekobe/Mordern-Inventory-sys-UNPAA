const sequelize = require("../config/database");
const createUser = require("./User");
const createShop = require("./Shop");
const createUserShop = require("./UserShop");
const createCategory = require("./Category");
const createProduct = require("./Product");
const createProductVariant = require("./ProductVariant");
const createCategoryVariantTemplate = require("./CategoryVariantTemplate");
const createMessage = require("./Message");
const createMessageReply = require("./MessageReply");
const createOfflineSale = require("./OfflineSale");
const createOfflineSaleItem = require("./OfflineSaleItem");

const User = createUser(sequelize);
const Shop = createShop(sequelize);
const UserShop = createUserShop(sequelize);
const Category = createCategory(sequelize);
const Product = createProduct(sequelize);
const ProductVariant = createProductVariant(sequelize);
const CategoryVariantTemplate = createCategoryVariantTemplate(sequelize);
const Message = createMessage(sequelize);
const MessageReply = createMessageReply(sequelize);
const OfflineSale = createOfflineSale(sequelize);
const OfflineSaleItem = createOfflineSaleItem(sequelize);

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

Shop.hasMany(Message, { foreignKey: { allowNull: false } });
Message.belongsTo(Shop);

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

User.hasMany(Message);
Message.belongsTo(User);
Message.hasMany(MessageReply, { onDelete: "CASCADE" });
MessageReply.belongsTo(Message);
MessageReply.belongsTo(User);

module.exports = {
  sequelize,
  User,
  Shop,
  UserShop,
  Category,
  Product,
  ProductVariant,
  CategoryVariantTemplate,
  Message,
  MessageReply,
  OfflineSale,
  OfflineSaleItem,
};

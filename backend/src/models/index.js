const sequelize = require("../config/database");
const createUser = require("./User");
const createShop = require("./Shop");
const createUserShop = require("./UserShop");
const createCategory = require("./Category");
const createProduct = require("./Product");
const createProductVariant = require("./ProductVariant");
const createCategoryVariantTemplate = require("./CategoryVariantTemplate");
const createCart = require("./Cart");
const createCartItem = require("./CartItem");
const createOrder = require("./Order");
const createOrderItem = require("./OrderItem");
const createOrderStatusEvent = require("./OrderStatusEvent");
const createOrderNotification = require("./OrderNotification");
const createPayment = require("./Payment");
const createPaymentEvent = require("./PaymentEvent");
const createSLAJobRun = require("./SLAJobRun");
const createCoupon = require("./Coupon");
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
const Cart = createCart(sequelize);
const CartItem = createCartItem(sequelize);
const Order = createOrder(sequelize);
const OrderItem = createOrderItem(sequelize);
const OrderStatusEvent = createOrderStatusEvent(sequelize);
const OrderNotification = createOrderNotification(sequelize);
const Payment = createPayment(sequelize);
const PaymentEvent = createPaymentEvent(sequelize);
const SLAJobRun = createSLAJobRun(sequelize);
const Coupon = createCoupon(sequelize);
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

Shop.hasMany(Cart, { foreignKey: { allowNull: false } });
Cart.belongsTo(Shop);

Shop.hasMany(CartItem, { foreignKey: { allowNull: false } });
CartItem.belongsTo(Shop);

Shop.hasMany(Order, { foreignKey: { allowNull: false } });
Order.belongsTo(Shop);

Shop.hasMany(OrderItem, { foreignKey: { allowNull: false } });
OrderItem.belongsTo(Shop);

Shop.hasMany(Coupon, { foreignKey: { allowNull: false } });
Coupon.belongsTo(Shop);

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

Shop.hasMany(OrderNotification, { foreignKey: { allowNull: false } });
OrderNotification.belongsTo(Shop);

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
  onDelete: "CASCADE" 
});
ProductVariant.belongsTo(Product);

User.hasOne(Cart);
Cart.belongsTo(User);

Cart.hasMany(CartItem, { onDelete: "CASCADE" });
CartItem.belongsTo(Cart);
Product.hasMany(CartItem);
CartItem.belongsTo(Product);
ProductVariant.hasMany(CartItem, { foreignKey: "VariantId" });
CartItem.belongsTo(ProductVariant, { foreignKey: "VariantId" });

User.hasMany(Order);
Order.belongsTo(User);
Order.hasMany(OrderItem, { onDelete: "CASCADE" });
OrderItem.belongsTo(Order);
Product.hasMany(OrderItem);
OrderItem.belongsTo(Product);
Order.hasMany(OrderStatusEvent, { onDelete: "CASCADE" });
OrderStatusEvent.belongsTo(Order);

User.hasMany(OrderNotification);
OrderNotification.belongsTo(User);
Order.hasMany(OrderNotification, { onDelete: "CASCADE" });
OrderNotification.belongsTo(Order);

Order.hasMany(Payment, { onDelete: "CASCADE" });
Payment.belongsTo(Order);

// Coupon associations
Order.belongsTo(Coupon, { foreignKey: { allowNull: true } });
Coupon.hasMany(Order);

// Message and MessageReply associations
User.hasMany(Message);
Message.belongsTo(User);
Message.hasMany(MessageReply, { onDelete: "CASCADE" });
MessageReply.belongsTo(Message);
MessageReply.belongsTo(User); // author of the reply (customer or admin)

module.exports = {
  sequelize,
  User,
  Shop,
  UserShop,
  Category,
  Product,
  ProductVariant,
  CategoryVariantTemplate,
  Cart,
  CartItem,
  Order,
  OrderItem,
  OrderStatusEvent,
  OrderNotification,
  Payment,
  PaymentEvent,
  SLAJobRun,
  Coupon,
  Message,
  MessageReply,
  OfflineSale,
  OfflineSaleItem,
};

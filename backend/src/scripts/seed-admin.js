require("../config/env");
const bcrypt = require("bcrypt");
const { User } = require("../models");

const run = async () => {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || "Admin";

  if (!email || !password) {
    // eslint-disable-next-line no-console
    console.error("ADMIN_EMAIL and ADMIN_PASSWORD are required.");
    process.exit(1);
  }

  const existing = await User.findOne({ where: { email } });
  if (existing) {
    // eslint-disable-next-line no-console
    console.log("Admin user already exists.");
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await User.create({ name, email, passwordHash, role: "admin" });
  // eslint-disable-next-line no-console
  console.log("Admin user created.");
  process.exit(0);
};

run();

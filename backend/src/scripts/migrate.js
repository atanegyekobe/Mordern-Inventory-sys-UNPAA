require("../config/env");
const bcrypt = require("bcrypt");
const { sequelize } = require("../models");
const { randomUUID } = require("crypto");

const tableExists = async (tableName) => {
  const [rows] = await sequelize.query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = :tableName
      ) AS exists;
    `,
    {
      replacements: { tableName },
    }
  );

  return Boolean(rows[0]?.exists);
};

const ensureBaseSchema = async () => {
  const usersExists = await tableExists("users");
  if (usersExists) {
    return;
  }

  console.log("Users table not found. Bootstrapping base schema via Sequelize sync...");
  await sequelize.sync();
  console.log("Base schema bootstrap complete.");
};

const migrations = [
  {
    name: "20260313_add_order_status_enum_values",
    run: async () => {
      await sequelize.query(`
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_orders_status') THEN
            ALTER TYPE "enum_orders_status" ADD VALUE IF NOT EXISTS 'pending_payment';
            ALTER TYPE "enum_orders_status" ADD VALUE IF NOT EXISTS 'packed';
            ALTER TYPE "enum_orders_status" ADD VALUE IF NOT EXISTS 'shipped';
            ALTER TYPE "enum_orders_status" ADD VALUE IF NOT EXISTS 'out_for_delivery';
            ALTER TYPE "enum_orders_status" ADD VALUE IF NOT EXISTS 'delivered';
            ALTER TYPE "enum_orders_status" ADD VALUE IF NOT EXISTS 'received';
            ALTER TYPE "enum_orders_status" ADD VALUE IF NOT EXISTS 'delivery_failed';
            ALTER TYPE "enum_orders_status" ADD VALUE IF NOT EXISTS 'returned';
            ALTER TYPE "enum_orders_status" ADD VALUE IF NOT EXISTS 'refunded';
            ALTER TYPE "enum_orders_status" ADD VALUE IF NOT EXISTS 'fraud_hold';
            ALTER TYPE "enum_orders_status" ADD VALUE IF NOT EXISTS 'processing';
            ALTER TYPE "enum_orders_status" ADD VALUE IF NOT EXISTS 'delivery_pickup';
            ALTER TYPE "enum_orders_status" ADD VALUE IF NOT EXISTS 'fulfilled';
          END IF;
        END
        $$;
      `);
    },
  },
  {
    name: "20260313_add_order_notifications_table",
    run: async () => {
      await sequelize.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'users'
          ) AND EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'orders'
          ) THEN
            CREATE TABLE IF NOT EXISTS order_notifications (
              id UUID PRIMARY KEY,
              status VARCHAR(32) NOT NULL,
              subject VARCHAR(200) NOT NULL,
              content TEXT NOT NULL,
              read_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
              user_id UUID REFERENCES users(id) ON DELETE CASCADE,
              order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
              updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
          END IF;
        END
        $$;
      `);
    },
  },
  {
    name: "20260313_add_messages_read_at_column",
    run: async () => {
      await sequelize.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'messages'
          ) THEN
            ALTER TABLE messages
            ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
          END IF;
        END
        $$;
      `);
    },
  },
  {
    name: "20260313_add_sla_job_runs_table",
    run: async () => {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS sla_job_runs (
          id UUID PRIMARY KEY,
          trigger_source VARCHAR(32) NOT NULL,
          status VARCHAR(24) NOT NULL,
          duration_ms INTEGER DEFAULT NULL,
          started_at TIMESTAMP WITH TIME ZONE NOT NULL,
          finished_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
          results JSONB DEFAULT NULL,
          error TEXT DEFAULT NULL,
          instance_id VARCHAR(120) DEFAULT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

      await sequelize.query(
        "CREATE INDEX IF NOT EXISTS idx_sla_job_runs_created_at ON sla_job_runs (created_at DESC);"
      );
      await sequelize.query(
        "CREATE INDEX IF NOT EXISTS idx_sla_job_runs_status ON sla_job_runs (status);"
      );
    },
  },
  {
    name: "20260323_add_categories_parent_id",
    run: async () => {
      await sequelize.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'categories'
          ) THEN
            ALTER TABLE categories
            ADD COLUMN IF NOT EXISTS parent_id UUID NULL;

            IF NOT EXISTS (
              SELECT 1
              FROM information_schema.table_constraints
              WHERE table_name = 'categories'
                AND constraint_name = 'categories_parent_id_fkey'
            ) THEN
              ALTER TABLE categories
              ADD CONSTRAINT categories_parent_id_fkey
              FOREIGN KEY (parent_id) REFERENCES categories(id)
              ON DELETE SET NULL;
            END IF;

            CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
          END IF;
        END
        $$;
      `);
    },
  },
  {
    name: "20260331_add_payments_table",
    run: async () => {
      await sequelize.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'orders'
          ) THEN
            CREATE TABLE IF NOT EXISTS payments (
              id UUID PRIMARY KEY,
              payment_reference VARCHAR(200) NOT NULL,
              provider VARCHAR(40) NOT NULL DEFAULT 'paystack',
              status VARCHAR(40) NOT NULL DEFAULT 'initialized',
              amount NUMERIC(12,2) NULL,
              currency VARCHAR(8) NULL,
              payload JSONB NULL,
              processed_at TIMESTAMP WITH TIME ZONE NULL,
              verified_at TIMESTAMP WITH TIME ZONE NULL,
              order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
              updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_payment_reference_unique
              ON payments(payment_reference);
            CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
            CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
          END IF;
        END
        $$;
      `);
    },
  },
  {
    name: "20260331_add_payment_events_table",
    run: async () => {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS payment_events (
          id UUID PRIMARY KEY,
          payment_reference VARCHAR(200) NOT NULL,
          event_type VARCHAR(120) NOT NULL,
          payload JSONB NULL,
          processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(payment_reference, event_type)
        );
      `);

      await sequelize.query(
        "CREATE INDEX IF NOT EXISTS idx_payment_events_reference ON payment_events(payment_reference);"
      );
    },
  },
  {
    name: "20260331_financial_minor_units",
    run: async () => {
      await sequelize.query(`
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'products') THEN
            ALTER TABLE products ADD COLUMN IF NOT EXISTS price_minor INTEGER NOT NULL DEFAULT 0;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_minor INTEGER NULL;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS compare_at_price_minor INTEGER NULL;

            UPDATE products
            SET
              price_minor = COALESCE(ROUND(COALESCE(price, 0) * 100)::INTEGER, 0),
              cost_minor = CASE WHEN cost IS NULL THEN NULL ELSE ROUND(cost * 100)::INTEGER END,
              compare_at_price_minor = CASE WHEN compare_at_price IS NULL THEN NULL ELSE ROUND(compare_at_price * 100)::INTEGER END;
          END IF;

          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_minor INTEGER NOT NULL DEFAULT 0;
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_paid INTEGER NOT NULL DEFAULT 0;
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS balance_due INTEGER NOT NULL DEFAULT 0;

            UPDATE orders
            SET
              total_minor = COALESCE(ROUND(COALESCE(total, 0) * 100)::INTEGER, 0),
              total_paid = COALESCE(total_paid, 0),
              balance_due = GREATEST(
                COALESCE(ROUND(COALESCE(total, 0) * 100)::INTEGER, 0) - COALESCE(total_paid, 0),
                0
              );
          END IF;

          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_items') THEN
            ALTER TABLE order_items ADD COLUMN IF NOT EXISTS unit_price_minor INTEGER NOT NULL DEFAULT 0;
            ALTER TABLE order_items ADD COLUMN IF NOT EXISTS price_at_purchase INTEGER NOT NULL DEFAULT 0;
            ALTER TABLE order_items ADD COLUMN IF NOT EXISTS cost_at_purchase INTEGER NOT NULL DEFAULT 0;

            UPDATE order_items oi
            SET
              unit_price_minor = COALESCE(ROUND(COALESCE(oi.unit_price, 0) * 100)::INTEGER, 0),
              price_at_purchase = COALESCE(ROUND(COALESCE(oi.unit_price, 0) * 100)::INTEGER, 0),
              cost_at_purchase = COALESCE(p.cost_minor, 0)
            FROM products p
            WHERE p.id = oi.product_id;
          END IF;

          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payments') THEN
            ALTER TABLE payments
            ALTER COLUMN amount TYPE INTEGER
            USING CASE
              WHEN amount IS NULL THEN NULL
              ELSE ROUND(amount * 100)::INTEGER
            END;
          END IF;
        END
        $$;
      `);
    },
  },
  {
    name: "20260403_multi_tenant_shops",
    run: async () => {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS shops (
          id UUID PRIMARY KEY,
          name VARCHAR(160) NOT NULL,
          slug VARCHAR(180) NOT NULL UNIQUE,
          owner_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
          config JSONB NOT NULL DEFAULT '{}'::JSONB,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        );
      `);

      await sequelize.query(
        "CREATE INDEX IF NOT EXISTS idx_shops_owner_id ON shops(owner_id);"
      );

      const [existingShops] = await sequelize.query(
        "SELECT id FROM shops ORDER BY created_at ASC LIMIT 1;"
      );

      let defaultShopId = existingShops[0]?.id || null;

      if (!defaultShopId) {
        const [ownerRows] = await sequelize.query(`
          SELECT id
          FROM users
          ORDER BY CASE WHEN role = 'admin' THEN 0 ELSE 1 END, created_at ASC NULLS LAST
          LIMIT 1;
        `);

        let ownerId = ownerRows[0]?.id || null;
        if (!ownerId) {
          const bootstrapOwnerId = randomUUID();
          const bootstrapEmail = `bootstrap-owner-${Date.now()}@local.invalid`;
          const bootstrapPasswordHash = await bcrypt.hash(randomUUID(), 10);

          await sequelize.query(
            `
              INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
              VALUES (:id, :name, :email, :passwordHash, 'admin', NOW(), NOW())
            `,
            {
              replacements: {
                id: bootstrapOwnerId,
                name: "Bootstrap Owner",
                email: bootstrapEmail,
                passwordHash: bootstrapPasswordHash,
              },
            }
          );

          ownerId = bootstrapOwnerId;
          console.log(
            `No users found during shop migration. Created bootstrap owner user (${bootstrapEmail}).`
          );
        }

        defaultShopId = randomUUID();
        await sequelize.query(
          `
            INSERT INTO shops (id, name, slug, owner_id, config, created_at)
            VALUES (:id, :name, :slug, :ownerId, '{}'::JSONB, NOW())
          `,
          {
            replacements: {
              id: defaultShopId,
              name: "Main Shop",
              slug: "main-shop",
              ownerId,
            },
          }
        );
      }

      await sequelize.query(`ALTER TABLE categories ADD COLUMN IF NOT EXISTS shop_id UUID;`);
      await sequelize.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS shop_id UUID;`);
      await sequelize.query(`ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS shop_id UUID;`);
      await sequelize.query(`ALTER TABLE carts ADD COLUMN IF NOT EXISTS shop_id UUID;`);
      await sequelize.query(`ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS shop_id UUID;`);
      await sequelize.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS shop_id UUID;`);
      await sequelize.query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS shop_id UUID;`);
      await sequelize.query(`ALTER TABLE coupons ADD COLUMN IF NOT EXISTS shop_id UUID;`);

      await sequelize.query(
        `UPDATE categories SET shop_id = :shopId WHERE shop_id IS NULL;`,
        { replacements: { shopId: defaultShopId } }
      );
      await sequelize.query(
        `UPDATE products SET shop_id = :shopId WHERE shop_id IS NULL;`,
        { replacements: { shopId: defaultShopId } }
      );
      await sequelize.query(`
        UPDATE product_variants pv
        SET shop_id = p.shop_id
        FROM products p
        WHERE pv.product_id = p.id
          AND pv.shop_id IS NULL;
      `);
      await sequelize.query(
        `UPDATE product_variants SET shop_id = :shopId WHERE shop_id IS NULL;`,
        { replacements: { shopId: defaultShopId } }
      );

      await sequelize.query(
        `UPDATE carts SET shop_id = :shopId WHERE shop_id IS NULL;`,
        { replacements: { shopId: defaultShopId } }
      );
      await sequelize.query(`
        UPDATE cart_items ci
        SET shop_id = c.shop_id
        FROM carts c
        WHERE ci.cart_id = c.id
          AND ci.shop_id IS NULL;
      `);
      await sequelize.query(
        `UPDATE cart_items SET shop_id = :shopId WHERE shop_id IS NULL;`,
        { replacements: { shopId: defaultShopId } }
      );

      await sequelize.query(
        `UPDATE orders SET shop_id = :shopId WHERE shop_id IS NULL;`,
        { replacements: { shopId: defaultShopId } }
      );
      await sequelize.query(`
        UPDATE order_items oi
        SET shop_id = o.shop_id
        FROM orders o
        WHERE oi.order_id = o.id
          AND oi.shop_id IS NULL;
      `);
      await sequelize.query(
        `UPDATE order_items SET shop_id = :shopId WHERE shop_id IS NULL;`,
        { replacements: { shopId: defaultShopId } }
      );

      await sequelize.query(
        `UPDATE coupons SET shop_id = :shopId WHERE shop_id IS NULL;`,
        { replacements: { shopId: defaultShopId } }
      );

      await sequelize.query(`ALTER TABLE categories ALTER COLUMN shop_id SET NOT NULL;`);
      await sequelize.query(`ALTER TABLE products ALTER COLUMN shop_id SET NOT NULL;`);
      await sequelize.query(`ALTER TABLE product_variants ALTER COLUMN shop_id SET NOT NULL;`);
      await sequelize.query(`ALTER TABLE carts ALTER COLUMN shop_id SET NOT NULL;`);
      await sequelize.query(`ALTER TABLE cart_items ALTER COLUMN shop_id SET NOT NULL;`);
      await sequelize.query(`ALTER TABLE orders ALTER COLUMN shop_id SET NOT NULL;`);
      await sequelize.query(`ALTER TABLE order_items ALTER COLUMN shop_id SET NOT NULL;`);
      await sequelize.query(`ALTER TABLE coupons ALTER COLUMN shop_id SET NOT NULL;`);

      await sequelize.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_name = 'categories' AND constraint_name = 'categories_shop_id_fkey'
          ) THEN
            ALTER TABLE categories
            ADD CONSTRAINT categories_shop_id_fkey
            FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE RESTRICT;
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_name = 'products' AND constraint_name = 'products_shop_id_fkey'
          ) THEN
            ALTER TABLE products
            ADD CONSTRAINT products_shop_id_fkey
            FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE RESTRICT;
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_name = 'product_variants' AND constraint_name = 'product_variants_shop_id_fkey'
          ) THEN
            ALTER TABLE product_variants
            ADD CONSTRAINT product_variants_shop_id_fkey
            FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE RESTRICT;
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_name = 'carts' AND constraint_name = 'carts_shop_id_fkey'
          ) THEN
            ALTER TABLE carts
            ADD CONSTRAINT carts_shop_id_fkey
            FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE RESTRICT;
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_name = 'cart_items' AND constraint_name = 'cart_items_shop_id_fkey'
          ) THEN
            ALTER TABLE cart_items
            ADD CONSTRAINT cart_items_shop_id_fkey
            FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE RESTRICT;
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_name = 'orders' AND constraint_name = 'orders_shop_id_fkey'
          ) THEN
            ALTER TABLE orders
            ADD CONSTRAINT orders_shop_id_fkey
            FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE RESTRICT;
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_name = 'order_items' AND constraint_name = 'order_items_shop_id_fkey'
          ) THEN
            ALTER TABLE order_items
            ADD CONSTRAINT order_items_shop_id_fkey
            FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE RESTRICT;
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_name = 'coupons' AND constraint_name = 'coupons_shop_id_fkey'
          ) THEN
            ALTER TABLE coupons
            ADD CONSTRAINT coupons_shop_id_fkey
            FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE RESTRICT;
          END IF;
        END
        $$;
      `);

      await sequelize.query("CREATE INDEX IF NOT EXISTS idx_categories_shop_id ON categories(shop_id);");
      await sequelize.query("CREATE INDEX IF NOT EXISTS idx_products_shop_id ON products(shop_id);");
      await sequelize.query("CREATE INDEX IF NOT EXISTS idx_product_variants_shop_id ON product_variants(shop_id);");
      await sequelize.query("CREATE INDEX IF NOT EXISTS idx_carts_shop_id ON carts(shop_id);");
      await sequelize.query("CREATE INDEX IF NOT EXISTS idx_cart_items_shop_id ON cart_items(shop_id);");
      await sequelize.query("CREATE INDEX IF NOT EXISTS idx_orders_shop_id ON orders(shop_id);");
      await sequelize.query("CREATE INDEX IF NOT EXISTS idx_order_items_shop_id ON order_items(shop_id);");
      await sequelize.query("CREATE INDEX IF NOT EXISTS idx_coupons_shop_id ON coupons(shop_id);");

      await sequelize.query(`ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_slug_key;`);
      await sequelize.query(`ALTER TABLE products DROP CONSTRAINT IF EXISTS products_slug_key;`);
      await sequelize.query(`ALTER TABLE coupons DROP CONSTRAINT IF EXISTS coupons_code_key;`);

      await sequelize.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_shop_slug_unique
        ON categories(shop_id, slug);
      `);
      await sequelize.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_products_shop_slug_unique
        ON products(shop_id, slug);
      `);
      await sequelize.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_coupons_shop_code_unique
        ON coupons(shop_id, code);
      `);
    },
  },
  {
    name: "20260403_multi_tenant_shop_uniques",
    run: async () => {
      await sequelize.query(`ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_slug_key;`);
      await sequelize.query(`ALTER TABLE products DROP CONSTRAINT IF EXISTS products_slug_key;`);
      await sequelize.query(`ALTER TABLE coupons DROP CONSTRAINT IF EXISTS coupons_code_key;`);

      await sequelize.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_shop_slug_unique
        ON categories(shop_id, slug);
      `);
      await sequelize.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_products_shop_slug_unique
        ON products(shop_id, slug);
      `);
      await sequelize.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_coupons_shop_code_unique
        ON coupons(shop_id, code);
      `);
    },
  },
  {
    name: "20260403_multi_tenant_support_tables",
    run: async () => {
      await sequelize.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS shop_id UUID;`);
      await sequelize.query(`ALTER TABLE order_notifications ADD COLUMN IF NOT EXISTS shop_id UUID;`);

      await sequelize.query(`
        UPDATE messages
        SET shop_id = COALESCE(shop_id, (SELECT id FROM shops ORDER BY created_at ASC LIMIT 1))
        WHERE shop_id IS NULL;
      `);
      await sequelize.query(`
        UPDATE order_notifications
        SET shop_id = COALESCE(order_notifications.shop_id, orders.shop_id)
        FROM orders
        WHERE order_notifications.order_id = orders.id
          AND order_notifications.shop_id IS NULL;
      `);
      await sequelize.query(`
        UPDATE order_notifications
        SET shop_id = COALESCE(shop_id, (SELECT id FROM shops ORDER BY created_at ASC LIMIT 1))
        WHERE shop_id IS NULL;
      `);

      await sequelize.query(`ALTER TABLE messages ALTER COLUMN shop_id SET NOT NULL;`);
      await sequelize.query(`ALTER TABLE order_notifications ALTER COLUMN shop_id SET NOT NULL;`);

      await sequelize.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_name = 'messages' AND constraint_name = 'messages_shop_id_fkey'
          ) THEN
            ALTER TABLE messages
            ADD CONSTRAINT messages_shop_id_fkey
            FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE RESTRICT;
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_name = 'order_notifications' AND constraint_name = 'order_notifications_shop_id_fkey'
          ) THEN
            ALTER TABLE order_notifications
            ADD CONSTRAINT order_notifications_shop_id_fkey
            FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE RESTRICT;
          END IF;
        END
        $$;
      `);

      await sequelize.query("CREATE INDEX IF NOT EXISTS idx_messages_shop_id ON messages(shop_id);");
      await sequelize.query("CREATE INDEX IF NOT EXISTS idx_order_notifications_shop_id ON order_notifications(shop_id);");
    },
  },
  {
    name: "20260403_users_add_shop_owner_role",
    run: async () => {
      await sequelize.query(`
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_users_role') THEN
            ALTER TYPE "enum_users_role" ADD VALUE IF NOT EXISTS 'shop_owner';
          END IF;
        END
        $$;
      `);
    },
  },
  {
    name: "20260403_create_user_shops",
    run: async () => {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS user_shops (
          id UUID PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
          role VARCHAR(16) NOT NULL CHECK (role IN ('OWNER', 'STAFF')),
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          UNIQUE (user_id, shop_id)
        );
      `);

      const [ownerLinks] = await sequelize.query(`
        SELECT owner_id AS user_id, id AS shop_id
        FROM shops
        WHERE owner_id IS NOT NULL;
      `);

      for (const link of ownerLinks) {
        await sequelize.query(
          `
            INSERT INTO user_shops (id, user_id, shop_id, role, created_at, updated_at)
            VALUES (:id, :userId, :shopId, 'OWNER', NOW(), NOW())
            ON CONFLICT (user_id, shop_id)
            DO UPDATE SET role = 'OWNER', updated_at = NOW();
          `,
          {
            replacements: {
              id: randomUUID(),
              userId: link.user_id,
              shopId: link.shop_id,
            },
          }
        );
      }

      const [staffLinks] = await sequelize.query(`
        SELECT linked.user_id, linked.shop_id
        FROM (
          SELECT o.user_id, o.shop_id FROM orders o
          UNION
          SELECT c.user_id, c.shop_id FROM carts c
          UNION
          SELECT m.user_id, m.shop_id FROM messages m
        ) linked
        WHERE linked.user_id IS NOT NULL AND linked.shop_id IS NOT NULL;
      `);

      for (const link of staffLinks) {
        await sequelize.query(
          `
            INSERT INTO user_shops (id, user_id, shop_id, role, created_at, updated_at)
            VALUES (:id, :userId, :shopId, 'STAFF', NOW(), NOW())
            ON CONFLICT (user_id, shop_id) DO NOTHING;
          `,
          {
            replacements: {
              id: randomUUID(),
              userId: link.user_id,
              shopId: link.shop_id,
            },
          }
        );
      }

      await sequelize.query("CREATE INDEX IF NOT EXISTS idx_user_shops_user_id ON user_shops(user_id);");
      await sequelize.query("CREATE INDEX IF NOT EXISTS idx_user_shops_shop_id ON user_shops(shop_id);");
    },
  },
  {
    name: "20260403_fix_categories_slug_uniqueness",
    run: async () => {
      await sequelize.query(`ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_slug_key;`);

      await sequelize.query(`
        DO $$
        DECLARE con RECORD;
        BEGIN
          FOR con IN
            SELECT c.conname
            FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            WHERE n.nspname = 'public'
              AND t.relname = 'categories'
              AND c.contype = 'u'
              AND pg_get_constraintdef(c.oid) ILIKE 'UNIQUE (slug)%'
          LOOP
            EXECUTE format('ALTER TABLE categories DROP CONSTRAINT IF EXISTS %I', con.conname);
          END LOOP;
        END
        $$;
      `);

      await sequelize.query(`
        DO $$
        DECLARE idx RECORD;
        BEGIN
          FOR idx IN
            SELECT indexname, indexdef
            FROM pg_indexes
            WHERE schemaname = 'public'
              AND tablename = 'categories'
              AND indexdef ILIKE 'CREATE UNIQUE INDEX%'
          LOOP
            IF idx.indexdef ILIKE '%(slug)%'
              AND idx.indexdef NOT ILIKE '%(shop_id, slug)%' THEN
              EXECUTE format('DROP INDEX IF EXISTS %I', idx.indexname);
            END IF;
          END LOOP;
        END
        $$;
      `);

      await sequelize.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_shop_slug_unique
        ON categories(shop_id, slug);
      `);
    },
  },
  {
    name: "20260404_create_offline_sales_tables",
    run: async () => {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS offline_sales (
          id UUID PRIMARY KEY,
          shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE RESTRICT,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
          total_amount INTEGER NOT NULL DEFAULT 0,
          status VARCHAR(16) NOT NULL CHECK (status IN ('COMPLETED', 'CANCELLED')),
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        );
      `);

      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS offline_sale_items (
          id UUID PRIMARY KEY,
          offline_sale_id UUID NOT NULL REFERENCES offline_sales(id) ON DELETE CASCADE,
          product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
          quantity INTEGER NOT NULL,
          price_at_sale INTEGER NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        );
      `);

      await sequelize.query(
        "CREATE INDEX IF NOT EXISTS idx_offline_sales_shop_id ON offline_sales(shop_id);"
      );
      await sequelize.query(
        "CREATE INDEX IF NOT EXISTS idx_offline_sales_user_id ON offline_sales(user_id);"
      );
      await sequelize.query(
        "CREATE INDEX IF NOT EXISTS idx_offline_sale_items_sale_id ON offline_sale_items(offline_sale_id);"
      );
      await sequelize.query(
        "CREATE INDEX IF NOT EXISTS idx_offline_sale_items_product_id ON offline_sale_items(product_id);"
      );
    },
  },
];

const ensureMigrationsTable = async () => {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id BIGSERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      run_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
  `);
};

const hasMigrationRun = async (name) => {
  const [rows] = await sequelize.query(
    "SELECT 1 FROM schema_migrations WHERE name = :name LIMIT 1",
    {
      replacements: { name },
    }
  );
  return rows.length > 0;
};

const markMigrationRun = async (name) => {
  await sequelize.query("INSERT INTO schema_migrations (name) VALUES (:name)", {
    replacements: { name },
  });
};

const run = async () => {
  try {
    await sequelize.authenticate();
    console.log("Database connection established.");

    await ensureBaseSchema();

    await ensureMigrationsTable();

    for (const migration of migrations) {
      const alreadyRun = await hasMigrationRun(migration.name);

      if (alreadyRun) {
        console.log(`- Skipping ${migration.name} (already applied)`);
        continue;
      }

      console.log(`- Applying ${migration.name}...`);
      await migration.run();
      await markMigrationRun(migration.name);
      console.log(`  Applied ${migration.name}`);
    }

    console.log("Migrations complete.");
    process.exit(0);
  } catch (error) {
    console.error("Migration run failed", error);
    process.exit(1);
  }
};

run();

export type Category = {
  id: string;
  name: string;
  slug: string;
};

export type Product = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  price: string | number;
  sku?: string | null;
  stock: number;
  status: "active" | "draft";
  imageUrl?: string | null;
  Category?: Category;
  CategoryId?: string;
};

export type Order = {
  id: string;
  status: "pending" | "paid" | "fulfilled" | "cancelled";
  total: string | number;
  currency: string;
  createdAt: string;
};

"use client";

import { useState, useMemo, useEffect } from "react";
import { formatCurrency } from "@/lib/format";
import type { Product, ProductVariant } from "@/lib/types";

interface VariantPickerProps {
  product: Product;
  onVariantSelect: (variant: ProductVariant | null) => void;
}

export default function VariantPickerCustomer({
  product,
  onVariantSelect,
}: VariantPickerProps) {
  const [selectedAttributes, setSelectedAttributes] = useState<
    Record<string, string>
  >({});

  const hasValue = (value: unknown) => {
    if (value === null || value === undefined) return false;
    if (typeof value === "string") return value.trim().length > 0;
    return true;
  };

  // Get all unique attribute keys from variants
  const attributeKeys = useMemo(() => {
    if (!product.ProductVariants || product.ProductVariants.length === 0) {
      return [];
    }
    const keys = new Set<string>();
    product.ProductVariants.forEach((variant) => {
      Object.entries(variant.attributes || {}).forEach(([key, value]) => {
        if (hasValue(value)) {
          keys.add(key);
        }
      });
    });
    return Array.from(keys).sort();
  }, [product.ProductVariants]);

  // Get unique values for each attribute that are available
  const getAvailableValues = (attributeKey: string): string[] => {
    if (!product.ProductVariants || product.ProductVariants.length === 0) {
      return [];
    }

    const values = new Set<string>();
    product.ProductVariants.forEach((variant) => {
      // Check if this variant matches all currently selected attributes
      let matches = true;
      Object.entries(selectedAttributes).forEach(([key, value]) => {
        if (key !== attributeKey && variant.attributes?.[key] !== value) {
          matches = false;
        }
      });

      const candidateValue = variant.attributes?.[attributeKey];
      if (matches && hasValue(candidateValue)) {
        values.add(String(candidateValue));
      }
    });
    return Array.from(values).sort();
  };

  // Find matching variant based on selections
  const selectedVariant = useMemo(() => {
    if (!product.ProductVariants || product.ProductVariants.length === 0) {
      return null;
    }

    // If no attributes selected, return null
    if (Object.keys(selectedAttributes).length === 0) {
      return null;
    }

    // Find variant matching all selected attributes
    const variant = product.ProductVariants.find((v) => {
      return Object.entries(selectedAttributes).every(
        ([key, value]) => v.attributes?.[key] === value
      );
    });

    return variant || null;
  }, [selectedAttributes, product.ProductVariants]);

  const handleAttributeChange = (key: string, value: string) => {
    setSelectedAttributes((prev) => {
      const next = { ...prev };
      if (value.trim()) {
        next[key] = value;
      } else {
        delete next[key];
      }
      return next;
    });
  };

  // Update parent with selected variant when all attributes are selected
  useEffect(() => {
    if (
      selectedVariant &&
      Object.keys(selectedAttributes).length === attributeKeys.length
    ) {
      onVariantSelect(selectedVariant);
    } else {
      onVariantSelect(null);
    }
  }, [selectedVariant, selectedAttributes, attributeKeys.length, onVariantSelect]);

  // Only show if product has variants
  if (!product.ProductVariants || product.ProductVariants.length === 0) {
    return null;
  }

  // Only show if there are attribute keys
  if (attributeKeys.length === 0) {
    return null;
  }

  const variantStock = selectedVariant?.stock ?? 0;
  const variantIsOutOfStock = variantStock <= 0;
  const variantPrice = selectedVariant?.price
    ? Number(selectedVariant.price)
    : Number(product.price);

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-6 mb-6">
      <h3 className="text-lg font-semibold mb-4">Select Options</h3>

      <div className="space-y-4">
        {attributeKeys.map((key) => {
          const availableValues = getAvailableValues(key);

          return (
            <div key={key}>
              <label className="block text-sm font-semibold text-black/70 mb-2 capitalize">
                {key}
              </label>
              <select
                value={selectedAttributes[key] || ""}
                onChange={(e) => handleAttributeChange(key, e.target.value)}
                className="w-full border border-black/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              >
                <option value="">Select {key}</option>
                {availableValues.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      {/* Selection Summary */}
      {selectedVariant && (
        <div className="mt-6 p-4 rounded-lg bg-black/5 border border-black/10">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-black/60">Your Selection:</span>
              <span className="text-sm font-semibold">
                {Object.entries(selectedAttributes)
                  .map(([key, value]) => `${key}: ${value}`)
                  .join(", ")}
              </span>
            </div>

            {variantPrice !== Number(product.price) && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-black/60">Price:</span>
                <span className="text-lg font-bold">{formatCurrency(variantPrice)}</span>
              </div>
            )}

            <div className="flex justify-between items-center">
              <span className="text-sm text-black/60">Stock:</span>
              <span
                className={`text-sm font-semibold ${
                  variantIsOutOfStock
                    ? "text-red-600"
                    : variantStock <= 3
                      ? "text-orange-600"
                      : "text-green-600"
                }`}
              >
                {variantIsOutOfStock
                  ? "Out of Stock"
                  : variantStock === 1
                    ? "Only 1 left"
                    : `${variantStock} in stock`}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

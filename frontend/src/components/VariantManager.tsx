"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { useToast } from "@/hooks/useToast";
import type { ProductVariant } from "@/lib/types";

interface AttributeDefinition {
  name: string;
  label: string;
  required: boolean;
  type: "text" | "number" | "select" | "color";
  options?: string[];
}

interface VariantManagerProps {
  productId: string;
  categoryId: string;
  variants: ProductVariant[];
  parentPrice: number;
  onVariantsChange: (variants: ProductVariant[]) => void;
}

interface VariantFormState {
  attributes: Record<string, string | number>;
  sku: string;
  price: string;
  stock: string;
  useParentPrice: boolean;
}

export default function VariantManager({
  productId,
  categoryId,
  variants,
  parentPrice,
  onVariantsChange,
}: VariantManagerProps) {
  const toast = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [template, setTemplate] = useState<AttributeDefinition[] | null>(null);
  const [templateDescription, setTemplateDescription] = useState("");
  const [newAttributeKey, setNewAttributeKey] = useState("");
  const [formState, setFormState] = useState<VariantFormState>({
    attributes: { size: "", color: "" },
    sku: "",
    price: "",
    stock: "0",
    useParentPrice: true,
  });
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Load category template
  useEffect(() => {
    const loadTemplate = async () => {
      try {
        const response = await api.get(`/categories/${categoryId}/variant-template`);
        if (response.data.template) {
          const def = response.data.template.attributeDefinitions || [];
          setTemplate(def);
          setTemplateDescription(response.data.template.description || "");

          // Initialize form with empty values for template attributes
          const initialAttributes: Record<string, string | number> = {};
          def.forEach((attr: AttributeDefinition) => {
            initialAttributes[attr.name] = "";
          });
          setFormState((prev) => ({ ...prev, attributes: initialAttributes }));
        }
      } catch {
        // No template, which is fine - use free form
        setTemplate(null);
        setTemplateDescription("");
        setFormState((prev) => ({
          ...prev,
          attributes: Object.keys(prev.attributes).length
            ? prev.attributes
            : { size: "", color: "" },
        }));
      }
    };

    loadTemplate();
  }, [categoryId]);

  const resetForm = () => {
    const initialAttributes: Record<string, string | number> = {};
    if (template) {
      template.forEach((attr) => {
        initialAttributes[attr.name] = "";
      });
    } else {
      initialAttributes.size = "";
      initialAttributes.color = "";
    }
    setFormState({
      attributes: initialAttributes,
      sku: "",
      price: "",
      stock: "0",
      useParentPrice: true,
    });
    setEditingId(null);
    setValidationErrors([]);
  };

  const addFallbackAttribute = () => {
    const key = newAttributeKey.trim().toLowerCase();
    if (!key) {
      return;
    }
    if (formState.attributes[key] !== undefined) {
      toast.warning("Attribute already exists.");
      return;
    }
    setFormState((prev) => ({
      ...prev,
      attributes: {
        ...prev.attributes,
        [key]: "",
      },
    }));
    setNewAttributeKey("");
  };

  const removeFallbackAttribute = (key: string) => {
    const next = { ...formState.attributes };
    delete next[key];
    setFormState((prev) => ({
      ...prev,
      attributes: next,
    }));
  };

  const openCreate = () => {
    resetForm();
    setIsOpen(true);
  };

  const openEdit = (variant: ProductVariant) => {
    setFormState({
      attributes: variant.attributes || {},
      sku: variant.sku || "",
      price: variant.price ? String(variant.price) : String(parentPrice),
      stock: String(variant.stock || 0),
      useParentPrice: !variant.price,
    });
    setEditingId(variant.id);
    setIsOpen(true);
  };

  const handleAttributeChange = (key: string, value: string | number) => {
    setFormState((prev) => ({
      ...prev,
      attributes: { ...prev.attributes, [key]: value },
    }));
    setValidationErrors([]);
  };

  const validateForm = (): boolean => {
    const errors: string[] = [];

    if (!template || template.length === 0) {
      return true; // No template, skip validation
    }

    // Check required fields
    template.forEach((attr) => {
      const value = formState.attributes[attr.name];
      if (attr.required && (!value || String(value).trim() === "")) {
        errors.push(`${attr.label || attr.name} is required.`);
      }

      // Type validation
      if (value && value !== "") {
        if (attr.type === "number" && isNaN(Number(value))) {
          errors.push(`${attr.label || attr.name} must be a number.`);
        }

        if (attr.type === "select" && !attr.options?.includes(String(value))) {
          errors.push(
            `${attr.label || attr.name} must be one of: ${attr.options?.join(", ")}`
          );
        }

        if (attr.type === "color") {
          const colorRegex = /^(#([0-9a-fA-F]{3}){1,2}|[a-zA-Z]+)$/;
          if (!colorRegex.test(String(value))) {
            errors.push(`${attr.label || attr.name} is not a valid color.`);
          }
        }
      }
    });

    if (errors.length > 0) {
      setValidationErrors(errors);
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    const payload = {
      attributes: formState.attributes,
      sku: formState.sku || null,
      price: formState.useParentPrice ? null : parseFloat(formState.price) || null,
      stock: parseInt(formState.stock) || 0,
    };

    try {
      if (editingId) {
        await api.patch(`/products/${productId}/variants/${editingId}`, payload);
        toast.success("Variant updated successfully!");
      } else {
        await api.post(`/products/${productId}/variants`, payload);
        toast.success("Variant created successfully!");
      }
      setIsOpen(false);
      resetForm();
      // Reload variants
      const response = await api.get(`/products/${productId}`);
      onVariantsChange(response.data.product.ProductVariants || []);
    } catch (error: unknown) {
      const errorMsg =
        error && typeof error === "object" && "response" in error
          ? (error as { response?: { data?: { details?: string[] } } }).response?.data
              ?.details?.[0] || "Unable to save variant."
          : "Unable to save variant.";
      toast.error(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (variantId: string) => {
    if (
      !window.confirm(
        "Delete this variant? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      await api.delete(`/products/${productId}/variants/${variantId}`);
      toast.success("Variant deleted successfully!");
      onVariantsChange(variants.filter((v) => v.id !== variantId));
    } catch {
      toast.error("Unable to delete variant.");
    }
  };

  const getAllAttributeKeys = (): string[] => {
    const keys = new Set<string>();
    variants.forEach((variant) => {
      Object.keys(variant.attributes || {}).forEach((key) => {
        keys.add(key);
      });
    });
    return Array.from(keys).sort();
  };

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-black/60">
            Product Variants
          </p>
          <p className="text-xs text-black/50">
            {template
              ? `Create variations using: ${template
                  .map((attribute) => attribute.label || attribute.name)
                  .join(", ")}`
              : "Create variations of this product with unique pricing and stock."}
          </p>
          {templateDescription ? (
            <p className="mt-2 text-xs italic text-black/50">{templateDescription}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-full bg-black px-4 py-2 text-xs font-semibold text-white"
        >
          Add variant
        </button>
      </div>

      {isOpen ? (
        <div className="mb-4 rounded-lg border border-black/10 bg-black/5 p-4">
          {validationErrors.length > 0 ? (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-xs font-semibold text-red-800">Validation Errors:</p>
              <ul className="mt-2 space-y-1">
                {validationErrors.map((error) => (
                  <li key={error} className="text-xs text-red-700">
                    • {error}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {template && template.length > 0 ? (
            <div className="mb-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-black/60">
                Attributes
              </p>
              <div className="space-y-3">
                {template.map((attribute) => (
                  <div key={attribute.name}>
                    <label className="mb-1 block text-xs text-black/60">
                      {attribute.label || attribute.name}
                      {attribute.required ? (
                        <span className="ml-1 text-red-600">*</span>
                      ) : null}
                    </label>

                    {attribute.type === "select" ? (
                      <select
                        value={String(formState.attributes[attribute.name] || "")}
                        onChange={(event) =>
                          handleAttributeChange(attribute.name, event.target.value)
                        }
                        className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                        required={attribute.required}
                      >
                        <option value="">Select {attribute.label || attribute.name}</option>
                        {attribute.options?.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : attribute.type === "number" ? (
                      <input
                        type="number"
                        value={formState.attributes[attribute.name] || ""}
                        onChange={(event) =>
                          handleAttributeChange(attribute.name, event.target.value)
                        }
                        className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                        required={attribute.required}
                      />
                    ) : attribute.type === "color" ? (
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={
                            String(formState.attributes[attribute.name] || "").startsWith("#")
                              ? String(formState.attributes[attribute.name])
                              : "#000000"
                          }
                          onChange={(event) =>
                            handleAttributeChange(attribute.name, event.target.value)
                          }
                          className="h-10 w-16 rounded border border-black/10"
                        />
                        <input
                          type="text"
                          value={formState.attributes[attribute.name] || ""}
                          onChange={(event) =>
                            handleAttributeChange(attribute.name, event.target.value)
                          }
                          placeholder="#000000 or color name"
                          className="flex-1 rounded-lg border border-black/10 px-3 py-2 text-sm"
                          required={attribute.required}
                        />
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={formState.attributes[attribute.name] || ""}
                        onChange={(event) =>
                          handleAttributeChange(attribute.name, event.target.value)
                        }
                        className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                        required={attribute.required}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mb-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-black/60">
                Attributes
              </p>
              <p className="mb-3 text-xs text-black/60">
                No category template found. Add attributes manually for this variant.
              </p>
              <div className="space-y-2">
                {Object.keys(formState.attributes).map((attributeKey) => (
                  <div key={attributeKey} className="flex items-end gap-2">
                    <label className="flex-1">
                      <span className="text-xs text-black/60">{attributeKey}</span>
                      <input
                        type="text"
                        value={String(formState.attributes[attributeKey] || "")}
                        onChange={(event) =>
                          handleAttributeChange(attributeKey, event.target.value)
                        }
                        className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                        placeholder={`Enter ${attributeKey}`}
                      />
                    </label>
                    {Object.keys(formState.attributes).length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeFallbackAttribute(attributeKey)}
                        className="rounded-lg border border-black/10 px-3 py-2 text-xs font-semibold text-red-600"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={newAttributeKey}
                  onChange={(event) => setNewAttributeKey(event.target.value)}
                  placeholder="New attribute key (e.g. material)"
                  className="flex-1 rounded-lg border border-black/10 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={addFallbackAttribute}
                  className="rounded-lg border border-black/10 px-4 py-2 text-xs font-semibold"
                >
                  Add field
                </button>
              </div>
            </div>
          )}

          <div className="mb-4 grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-black/60">
                SKU
              </span>
              <input
                type="text"
                placeholder="Optional variant SKU"
                value={formState.sku}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, sku: e.target.value }))
                }
                className="rounded-lg border border-black/10 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-black/60">
                Stock
              </span>
              <input
                type="number"
                value={formState.stock}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, stock: e.target.value }))
                }
                className="rounded-lg border border-black/10 px-3 py-2 text-sm"
                required
              />
            </label>
          </div>

          <div className="mb-4 flex items-center gap-3 rounded-lg border border-black/10 bg-white p-3">
            <input
              type="checkbox"
              checked={formState.useParentPrice}
              onChange={(e) =>
                setFormState((prev) => ({
                  ...prev,
                  useParentPrice: e.target.checked,
                }))
              }
              id="useParentPrice"
              className="cursor-pointer"
            />
            <label htmlFor="useParentPrice" className="flex-1 cursor-pointer text-xs">
              Use parent product price ({formatCurrency(parentPrice)})
            </label>
          </div>

          {!formState.useParentPrice && (
            <label className="mb-4 flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-black/60">
                Variant Price
              </span>
              <input
                type="number"
                step="0.01"
                value={formState.price}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, price: e.target.value }))
                }
                className="rounded-lg border border-black/10 px-3 py-2 text-sm"
                required
              />
            </label>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 rounded-lg bg-black px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : editingId ? "Update variant" : "Create variant"}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                resetForm();
              }}
              className="rounded-lg border border-black/10 px-4 py-2 text-xs font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {variants.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-black/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-black/5 text-xs uppercase tracking-[0.2em]">
              <tr>
                {getAllAttributeKeys().map((key) => (
                  <th key={key} className="px-4 py-3 font-semibold">
                    {key}
                  </th>
                ))}
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((variant) => (
                <tr key={variant.id} className="border-t border-black/10 hover:bg-black/2">
                  {getAllAttributeKeys().map((key) => (
                    <td key={key} className="px-4 py-3 text-sm font-medium">
                      {variant.attributes?.[key] || "—"}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-sm">{variant.sku || "—"}</td>
                  <td className="px-4 py-3 text-sm">
                    {formatCurrency(
                      variant.price ? parseFloat(String(variant.price)) : parentPrice
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">{variant.stock}</td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(variant)}
                        className="rounded-md px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(variant.id)}
                        className="rounded-md px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-black/50 italic">
          No variants yet. Add one to offer different options.
        </p>
      )}
    </div>
  );
}

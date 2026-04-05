"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { useToast } from "@/hooks/useToast";

interface AttributeDefinition {
  name: string;
  label: string;
  required: boolean;
  type: "text" | "number" | "select" | "color";
  options?: string[];
}

interface CategoryVariantTemplateEditorProps {
  categoryId: string;
  categoryName: string;
  onClose?: () => void;
}

export default function CategoryVariantTemplateEditor({
  categoryId,
  categoryName,
  onClose,
}: CategoryVariantTemplateEditorProps) {
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [attributes, setAttributes] = useState<AttributeDefinition[]>([]);
  const [description, setDescription] = useState("");
  const [newAttrName, setNewAttrName] = useState("");
  const [newAttrLabel, setNewAttrLabel] = useState("");
  const [newAttrType, setNewAttrType] = useState<"text" | "number" | "select" | "color">("text");
  const [newAttrRequired, setNewAttrRequired] = useState(true);
  const [newAttrOptions, setNewAttrOptions] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  useEffect(() => {
    const loadTemplate = async () => {
      try {
        const response = await api.get(`/categories/${categoryId}/variant-template`);
        if (response.data.template) {
          setAttributes(response.data.template.attributeDefinitions || []);
          setDescription(response.data.template.description || "");
        }
        setIsLoading(false);
      } catch {
        // No template exists yet, which is fine
        setIsLoading(false);
      }
    };

    loadTemplate();
  }, [categoryId]);

  const handleAddAttribute = () => {
    if (!newAttrName.trim()) {
      toast.warning("Attribute name is required");
      return;
    }

    if (editingIndex !== null) {
      // Update existing
      const updated = [...attributes];
      updated[editingIndex] = {
        name: newAttrName,
        label: newAttrLabel || newAttrName,
        required: newAttrRequired,
        type: newAttrType,
        options: newAttrType === "select" ? newAttrOptions.split(",").map((o) => o.trim()) : undefined,
      };
      setAttributes(updated);
      setEditingIndex(null);
    } else {
      // Add new
      setAttributes([
        ...attributes,
        {
          name: newAttrName,
          label: newAttrLabel || newAttrName,
          required: newAttrRequired,
          type: newAttrType,
          options: newAttrType === "select" ? newAttrOptions.split(",").map((o) => o.trim()) : undefined,
        },
      ]);
    }

    // Reset form
    setNewAttrName("");
    setNewAttrLabel("");
    setNewAttrType("text");
    setNewAttrRequired(true);
    setNewAttrOptions("");
  };

  const handleEditAttribute = (index: number) => {
    const attr = attributes[index];
    setNewAttrName(attr.name);
    setNewAttrLabel(attr.label);
    setNewAttrType(attr.type);
    setNewAttrRequired(attr.required);
    setNewAttrOptions(attr.options ? attr.options.join(", ") : "");
    setEditingIndex(index);
  };

  const handleDeleteAttribute = (index: number) => {
    setAttributes(attributes.filter((_, i) => i !== index));
    if (editingIndex === index) {
      setEditingIndex(null);
      setNewAttrName("");
      setNewAttrLabel("");
      setNewAttrType("text");
      setNewAttrRequired(true);
      setNewAttrOptions("");
    }
  };

  const handleSave = async () => {
    if (attributes.length === 0) {
      toast.warning("Add at least one attribute definition");
      return;
    }

    setIsSaving(true);
    try {
      await api.post(`/categories/${categoryId}/variant-template`, {
        attributeDefinitions: attributes,
        description: description || null,
      });
      toast.success("Variant template saved!");
      onClose?.();
    } catch {
      toast.error("Failed to save template");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-black/10 bg-white p-6">
        <p className="text-sm text-black/60">Loading template...</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold">{categoryName} - Variant Template</h3>
        <p className="mt-1 text-xs text-black/60">
          Define what variant attributes products in this category should have.
        </p>
      </div>

      {/* Description */}
      <div className="mb-6">
        <label className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-black/60">
            Description (optional)
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., 'T-shirts come in different sizes and colors. Always specify both.'"
            rows={3}
            className="rounded-lg border border-black/10 px-3 py-2 text-sm"
          />
        </label>
      </div>

      {/* Add/Edit Attribute Form */}
      <div className="mb-6 rounded-lg border border-black/10 bg-black/5 p-4">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-black/60">
          {editingIndex !== null ? "Edit Attribute" : "Add Attribute"}
        </p>

        <div className="grid gap-3 md:grid-cols-2">
          <input
            type="text"
            placeholder="Attribute name (e.g., 'size')"
            value={newAttrName}
            onChange={(e) => setNewAttrName(e.target.value)}
            className="rounded-lg border border-black/10 px-3 py-2 text-sm"
          />
          <input
            type="text"
            placeholder="Display label (optional)"
            value={newAttrLabel}
            onChange={(e) => setNewAttrLabel(e.target.value)}
            className="rounded-lg border border-black/10 px-3 py-2 text-sm"
          />

          <select
            value={newAttrType}
            onChange={(e) =>
              setNewAttrType(e.target.value as AttributeDefinition["type"])
            }
            className="rounded-lg border border-black/10 px-3 py-2 text-sm"
          >
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="select">Select (dropdown)</option>
            <option value="color">Color</option>
          </select>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={newAttrRequired}
              onChange={(e) => setNewAttrRequired(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm">Required</span>
          </label>
        </div>

        {newAttrType === "select" && (
          <div className="mt-3">
            <input
              type="text"
              placeholder="Options separated by commas (e.g., XS, S, M, L, XL)"
              value={newAttrOptions}
              onChange={(e) => setNewAttrOptions(e.target.value)}
              className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
            />
          </div>
        )}

        <div className="mt-3 flex gap-2">
          <button
            onClick={handleAddAttribute}
            disabled={!newAttrName.trim()}
            className="rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            {editingIndex !== null ? "Update Attribute" : "Add Attribute"}
          </button>
          {editingIndex !== null && (
            <button
              onClick={() => {
                setEditingIndex(null);
                setNewAttrName("");
                setNewAttrLabel("");
                setNewAttrType("text");
                setNewAttrRequired(true);
                setNewAttrOptions("");
              }}
              className="rounded-lg bg-gray-300 px-3 py-2 text-xs font-semibold hover:bg-gray-400"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Attributes List */}
      <div className="mb-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-black/60">
          Defined Attributes ({attributes.length})
        </p>
        {attributes.length > 0 ? (
          <div className="space-y-2">
            {attributes.map((attr, idx) => (
              <div key={idx} className="flex items-center justify-between rounded-lg border border-black/10 p-3">
                <div className="flex-1">
                  <p className="font-medium">{attr.label || attr.name}</p>
                  <p className="text-xs text-black/60">
                    {attr.type.charAt(0).toUpperCase() + attr.type.slice(1)}
                    {attr.required ? " (required)" : " (optional)"}
                    {attr.options && ` · ${attr.options.join(", ")}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditAttribute(idx)}
                    className="rounded-lg bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-200"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteAttribute(idx)}
                    className="rounded-lg bg-red-100 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-200"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-black/60">No attributes defined yet</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={isSaving || attributes.length === 0}
          className="rounded-full bg-black px-6 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save Template"}
        </button>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-full border border-black/10 px-6 py-2 text-sm font-semibold hover:border-black/20"
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
}

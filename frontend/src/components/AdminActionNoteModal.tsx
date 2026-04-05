"use client";

type AdminActionNoteModalProps = {
  open: boolean;
  title: string;
  description: string;
  note: string;
  error?: string;
  isSubmitting?: boolean;
  submitLabel?: string;
  onNoteChange: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
};

export default function AdminActionNoteModal({
  open,
  title,
  description,
  note,
  error,
  isSubmitting = false,
  submitLabel = "Continue",
  onNoteChange,
  onSubmit,
  onClose,
}: AdminActionNoteModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-black/10 bg-white p-6 shadow-2xl">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-black/60">{description}</p>

        <label className="mt-5 flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-black/50">
          Internal Note <span className="text-red-600">*</span>
          <textarea
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
            placeholder="Required internal note for audit trail (minimum 10 characters)"
            rows={4}
            className="rounded-xl border border-black/10 px-3 py-2 text-sm font-medium tracking-normal text-black placeholder:text-black/40"
          />
        </label>

        {error && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
            {error}
          </p>
        )}

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-full border border-black/15 px-4 py-2 text-sm font-semibold text-black/70 transition hover:border-black/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={isSubmitting}
            className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Saving..." : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
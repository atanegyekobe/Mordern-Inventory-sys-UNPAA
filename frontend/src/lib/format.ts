const accentMap: Record<string, string> = {
  essentials: "bg-gradient-to-br from-amber-100 via-orange-200 to-rose-200",
  wellness: "bg-gradient-to-br from-slate-100 via-sky-200 to-indigo-200",
  home: "bg-gradient-to-br from-emerald-100 via-teal-200 to-slate-200",
  stationery: "bg-gradient-to-br from-neutral-100 via-stone-200 to-amber-100",
};

export const accentForCategory = (slug?: string) =>
  accentMap[slug ?? ""] ?? accentMap.stationery;

export const formatCurrency = (value: string | number, currency = "USD") => {
  const amount = Number(value);
  if (Number.isNaN(amount)) {
    return "$0";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
};

export const formatDateShort = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
  }).format(date);
};

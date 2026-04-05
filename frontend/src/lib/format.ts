const accentMap: Record<string, string> = {
  essentials: "bg-gradient-to-br from-amber-100 via-orange-200 to-rose-200",
  wellness: "bg-gradient-to-br from-slate-100 via-sky-200 to-indigo-200",
  home: "bg-gradient-to-br from-emerald-100 via-teal-200 to-slate-200",
  stationery: "bg-gradient-to-br from-neutral-100 via-stone-200 to-amber-100",
};

export const accentForCategory = (slug?: string) =>
  accentMap[slug ?? ""] ?? accentMap.stationery;

export const formatCurrency = (value: string | number, currency = "GHS") => {
  const amount = Number(value);
  if (Number.isNaN(amount)) {
    return "GHS 0.00";
  }

  const normalizedCurrency =
    (currency || "GHS").toUpperCase() === "USD"
      ? "GHS"
      : (currency || "GHS").toUpperCase();

  try {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: normalizedCurrency,
      currencyDisplay: "code",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `GHS ${amount.toFixed(2)}`;
  }
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

export const formatDistanceToNow = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) {
    return "just now";
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes !== 1 ? "s" : ""} ago`;
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours !== 1 ? "s" : ""} ago`;
  }
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays} day${diffInDays !== 1 ? "s" : ""} ago`;
  }
  
  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `${diffInWeeks} week${diffInWeeks !== 1 ? "s" : ""} ago`;
  }
  
  const diffInMonths = Math.floor(diffInDays / 30);
  return `${diffInMonths} month${diffInMonths !== 1 ? "s" : ""} ago`;
};

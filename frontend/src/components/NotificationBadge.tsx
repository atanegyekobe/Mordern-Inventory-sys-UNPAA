interface NotificationBadgeProps {
  count: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
  color?: "red" | "blue" | "green" | "yellow";
}

export default function NotificationBadge({
  count,
  max = 99,
  size = "md",
  position = "top-right",
  color = "red",
}: NotificationBadgeProps) {
  if (count <= 0) return null;

  const displayCount = count > max ? `${max}+` : count;

  const sizeClasses = {
    sm: "h-4 w-4 text-[10px]",
    md: "h-5 w-5 text-xs",
    lg: "h-6 w-6 text-sm",
  };

  const positionClasses = {
    "top-right": "-right-1 -top-1",
    "top-left": "-left-1 -top-1",
    "bottom-right": "-right-1 -bottom-1",
    "bottom-left": "-left-1 -bottom-1",
  };

  const colorClasses = {
    red: "bg-red-600 text-white",
    blue: "bg-blue-600 text-white",
    green: "bg-green-600 text-white",
    yellow: "bg-yellow-500 text-white",
  };

  return (
    <span
      className={`absolute flex items-center justify-center rounded-full font-semibold ${sizeClasses[size]} ${positionClasses[position]} ${colorClasses[color]}`}
    >
      {displayCount}
    </span>
  );
}

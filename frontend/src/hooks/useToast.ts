import { useNotification } from "@/lib/notification-context";

export function useToast() {
  const { addNotification } = useNotification();

  return {
    success: (message: string, duration?: number) => addNotification("success", message, duration),
    error: (message: string, duration?: number) => addNotification("error", message, duration),
    info: (message: string, duration?: number) => addNotification("info", message, duration),
    warning: (message: string, duration?: number) => addNotification("warning", message, duration),
  };
}

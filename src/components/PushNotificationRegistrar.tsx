import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { registerForPushNotifications } from "@/lib/push-notifications";

/** Registriert das Gerät beim App-Start für Push-Notifications (nur nativ, no-op im Browser). */
export function PushNotificationRegistrar() {
  const { user } = useAuth();

  useEffect(() => {
    if (user) void registerForPushNotifications();
  }, [user?.id]);

  return null;
}

import { useState } from "react";
import { Pressable, View } from "react-native";
import { Bell } from "lucide-react-native";
import { NotificationSheet } from "./NotificationSheet";
import { useNotifications } from "./useNotifications";

export function NotificationBell() {
  const notifications = useNotifications();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          notifications.unread > 0
            ? `Notifications, ${notifications.unread} unread`
            : "Notifications"
        }
        onPress={() => {
          notifications.refresh();
          setOpen(true);
        }}
        style={{
          width: 40,
          height: 40,
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        <Bell size={24} color="#7C4DBE" />
        {notifications.unread > 0 && (
          <View
            style={{
              position: "absolute",
              width: 8,
              height: 8,
              borderRadius: 4,
              top: 8,
              right: 8,
              backgroundColor: "#BD4C42",
              borderWidth: 1,
              borderColor: "#FBF9FD",
            }}
          />
        )}
      </Pressable>
      <NotificationSheet
        visible={open}
        onClose={() => setOpen(false)}
        notifications={notifications}
      />
    </>
  );
}
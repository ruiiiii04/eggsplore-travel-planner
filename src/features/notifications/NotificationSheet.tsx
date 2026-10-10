import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Bell, Check, Plane, ReceiptText } from "lucide-react-native";
import { BottomSheet, Button, Message } from "@/components/ui";
import { timeAgo, type AppNotification } from "./model";
import type { useNotifications } from "./useNotifications";

type Props = {
  visible: boolean;
  onClose: () => void;
  notifications: ReturnType<typeof useNotifications>;
};

function iconFor(type: string) {
  const props = { size: 18, color: "#7E49C2" };
  if (type === "expense_added") return <ReceiptText {...props} />;
  if (type === "debt_paid") return <Check {...props} />;
  if (type === "flight_delay") return <Plane {...props} />;
  return <Bell {...props} />;
}

function go(item: AppNotification) {
  if (!item.tripId) return;
  const id = item.tripId;
  if (item.type === "note_reminder") {
    router.push({ pathname: "/trips/[id]/my-notes", params: { id } });
  } else if (item.type === "flight_delay") {
    router.push({ pathname: "/trips/[id]/itinerary", params: { id } });
  } else {
    router.push({ pathname: "/trips/[id]/budget", params: { id } });
  }
}

export function NotificationSheet({ visible, onClose, notifications }: Props) {
  const { items, unread, loading, error, markRead, markAllRead, refresh } =
    notifications;

  return (
    <BottomSheet visible={visible} title="Notifications" onClose={onClose}>
      {unread > 0 && (
        <Button variant="ghost" onPress={() => void markAllRead()}>
          Mark all as read
        </Button>
      )}
      {loading && items.length === 0 && <Message>Loading...</Message>}
      <Message error>{error}</Message>
      {!!error && (
        <Button variant="secondary" onPress={refresh}>
          Retry
        </Button>
      )}
      {!loading && !error && items.length === 0 && (
        <Message>
          No notifications yet. Shared expenses, payments and note reminders
          will show up here.
        </Message>
      )}
      {items.slice(0, 30).map((item) => (
        <Pressable
          key={item.key}
          accessibilityRole="button"
          onPress={() => {
            void markRead(item);
            onClose();
            go(item);
          }}
          className={`flex-row items-start gap-3 rounded-lg p-3 ${
            item.read ? "" : "bg-lavender"
          }`}
        >
          <View className="w-9 h-9 rounded-full bg-white items-center justify-center border border-line">
            {iconFor(item.type)}
          </View>
          <View className="flex-1 gap-0.5">
            <Text
              className={`text-sm text-ink ${
                item.read ? "font-medium" : "font-bold"
              }`}
            >
              {item.title}
            </Text>
            {!!item.body && (
              <Text className="text-xs text-muted">{item.body}</Text>
            )}
            <Text className="text-xs text-muted">{timeAgo(item.createdAt)}</Text>
          </View>
          {!item.read && <View className="w-2 h-2 rounded-full bg-brand mt-1.5" />}
        </Pressable>
      ))}
    </BottomSheet>
  );
}
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

import { C } from "../../lib/theme";

const TABS = [
  { name: "chat", title: "المحادثة", icon: "chatbubbles-outline" },
  { name: "contracts", title: "العقود", icon: "document-text-outline" },
  { name: "audit", title: "التدقيق", icon: "shield-checkmark-outline" },
  { name: "library", title: "المكتبة", icon: "library-outline" },
  { name: "settings", title: "الإعدادات", icon: "settings-outline" },
] as const;

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerTitleAlign: "center", headerTintColor: C.navy, tabBarActiveTintColor: C.teal, tabBarInactiveTintColor: C.muted }}>
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{ title: t.title, tabBarIcon: ({ color, size }) => <Ionicons name={t.icon} color={color as string} size={size} /> }}
        />
      ))}
    </Tabs>
  );
}

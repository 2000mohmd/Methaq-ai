import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { C, F, R } from "../../lib/theme";

const TABS = [
  { name: "chat", title: "المحادثة", icon: "chatbubbles" },
  { name: "contracts", title: "العقود", icon: "document-text" },
  { name: "audit", title: "التدقيق", icon: "shield-checkmark" },
  { name: "library", title: "المكتبة", icon: "library" },
  { name: "settings", title: "الإعدادات", icon: "settings" },
] as const;

const topShadow = Platform.select({
  ios: { shadowColor: C.navy, shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: -4 } },
  default: { elevation: 12 },
});

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 10);
  return (
    <Tabs
      screenOptions={{
        headerTitleAlign: "center",
        headerTintColor: C.navy,
        headerStyle: { backgroundColor: C.bg },
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: F.semibold, fontSize: 18, color: C.navy },
        tabBarActiveTintColor: C.teal,
        tabBarInactiveTintColor: C.muted,
        tabBarHideOnKeyboard: true,
        tabBarStyle: { height: 62 + bottom, paddingTop: 8, paddingBottom: bottom, backgroundColor: C.bg, borderTopWidth: 0, ...topShadow },
        tabBarLabelStyle: { fontFamily: F.medium, fontSize: 11, marginTop: 4 },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarIcon: ({ color, focused }) => (
              <View
                style={{
                  width: 56, height: 30, borderRadius: R.pill, alignItems: "center", justifyContent: "center",
                  backgroundColor: focused ? C.tealTint : "transparent",
                }}
              >
                <Ionicons name={focused ? t.icon : `${t.icon}-outline`} color={color as string} size={22} />
              </View>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

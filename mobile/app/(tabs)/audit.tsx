import { Text, View } from "react-native";

import { s } from "../../lib/theme";

// Placeholder — filled in by the audit screen task.
export default function Screen() {
  return (
    <View style={[s.screen, { padding: 16 }]}>
      <Text style={s.muted}>قريباً</Text>
    </View>
  );
}

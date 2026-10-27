import { View } from "react-native";

import { C } from "../lib/theme";

/** Entry: the root layout's route guard sends the user to welcome, onboarding or the app. */
export default function Index() {
  return <View style={{ flex: 1, backgroundColor: C.navy }} />;
}

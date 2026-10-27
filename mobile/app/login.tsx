import { Redirect } from "expo-router";

/** Old route kept for any deep links; sign-in now lives in app/(auth)/. */
export default function Login() {
  return <Redirect href="/sign-in" />;
}

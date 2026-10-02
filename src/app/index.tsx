import { Redirect } from "expo-router";
import { useAuth } from "@/features/auth/useAuth";
export default function Index() {
  const { user } = useAuth();
  return <Redirect href={user ? "/home" : "/login"} />;
}

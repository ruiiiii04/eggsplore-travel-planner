import { useState } from "react";
import { Image, View, Text } from "react-native";

import { Screen, Heading, Field, Button, Message } from "@/components/ui";
import { getSupabase, supabaseConfigurationError } from "@/lib/supabase";
import { errorMessage } from "@/lib/errors";
import { useAuth } from "./useAuth";
export default function LoginScreen() {
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const auth = useAuth();
  async function submit() {
    if (busy) return;
    setError("");
    setNotice("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || !password) {
      setError("Enter a valid email and password.");
      return;
    }
    if (signup && (password.length < 8 || password !== confirm)) {
      setError("Use at least 8 characters and matching passwords.");
      return;
    }
    setBusy(true);
    try {
      const client = getSupabase();
      if (signup) {
        const { data, error: failure } = await client.auth.signUp({
          email: email.trim(),
          password,
        });
        if (failure) throw failure;
        if (!data.session)
          setNotice(
            "Check your email to confirm your account, then return here to log in.",
          );
      } else {
        const { error: failure } = await client.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (failure) throw failure;
      }
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen>
      <Image
        source={require("../../../assets/eggsplore-logo.png")}
        accessibilityLabel="Eggsplore"
        resizeMode="contain"
        style={{
          width: 176,
          height: 176,
          alignSelf: "center",
          marginTop: 48,
          marginBottom: 32,
        }}
      />
      <View className="items-center gap-3">
        <Heading>Let's plan your next trip</Heading>
        <Text
          style={{ fontFamily: "Inter" }}
          className="text-muted text-center"
        >
          {signup
            ? "Sign up to start planning with Eggsplore"
            : "Log in to start planning with Eggsplore"}
        </Text>
      </View>
      <Field
        label="Email address"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        editable={!busy}
        placeholder="you@example.com"
      />
      <View className="gap-1">
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={signup ? "new-password" : "current-password"}
          editable={!busy}
          onSubmitEditing={() => {
            if (!signup) void submit();
          }}
        />
      </View>
      {signup && (
        <Field
          label="Confirm password"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          editable={!busy}
        />
      )}
      <Message error>{error || auth.error}</Message>
      <Message>{notice}</Message>
      <Button
        className="rounded-full"
        busy={busy}
        disabled={!!supabaseConfigurationError}
        onPress={() => void submit()}
      >
        {signup ? "Create Account" : "Login"}
      </Button>
      <Button
        variant="ghost"
        disabled={busy}
        onPress={() => {
          setSignup(!signup);
          setError("");
          setNotice("");
          setPassword("");
          setConfirm("");
        }}
      >
        {signup
          ? "Already have account? Login"
          : "New to Eggsplore? Create account"}
      </Button>
    </Screen>
  );
}

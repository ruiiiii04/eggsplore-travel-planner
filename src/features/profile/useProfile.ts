import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useAuth } from "@/features/auth/useAuth";
import { errorMessage } from "@/lib/errors";
import { readProfile } from "./service";
import type { Profile } from "./types";
export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setProfile(null);
      setError("");
      setLoading(true);
      if (!user) {
        setLoading(false);
        return;
      }
      void readProfile(user.id)
        .then((data) => {
          if (active) setProfile(data);
        })
        .catch((cause) => {
          if (active) setError(errorMessage(cause));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [user?.id, revision]),
  );
  return {
    profile,
    setProfile,
    loading,
    error,
    retry: () => setRevision((value) => value + 1),
  };
}

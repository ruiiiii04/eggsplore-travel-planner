const preferenceGuidance: Record<string, string> = {
  "Beach Trip": "beaches, swimming, coastal scenery, and a relaxed pace",
  "Backpacking Mode": "outdoor adventure, nature, affordable activities, and practical transport",
  "City Explorer": "urban culture, landmarks, neighborhoods, and sightseeing",
  "Foodie Adventure": "local cuisine, street food, markets, and notable food neighborhoods",
  "Nature Retreat": "nature, scenic walks, hiking, and wellness with a calm pace",
  "Luxury Getaway": "comfort, premium experiences, high quality dining, and relaxed pacing",
};

export function tripPreferenceGuidance(
  preference: string,
  customPreferences: string[],
): string[] {
  const selected = preference === "Custom"
    ? customPreferences
    : preference
      ? [preference]
      : [];
  return [...new Set(selected)]
    .slice(0, 6)
    .map((name) => preferenceGuidance[name] ? `${name}: ${preferenceGuidance[name]}` : name.slice(0, 100));
}

export function tripPreferencePayload(
  preference: string,
  customPreferences: string[],
) {
  const travelPreferences = tripPreferenceGuidance(preference, customPreferences);
  return {
    generationPreferences: travelPreferences,
    travelPreferences,
  };
}

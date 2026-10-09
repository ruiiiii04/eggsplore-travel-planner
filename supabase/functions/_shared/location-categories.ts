export function categoryVibes(categories: readonly string[] = []): string[] {
  const rules: [RegExp, string][] = [
    [/^(catering|commercial\.food_and_drink)/, "Foodie"],
    [/^(religion|heritage)|tourism\.sights|historic/, "Heritage"],
    [/^(natural|national_park)|leisure\.(park|garden|nature)/, "Nature"],
    [/^commercial|shopping/, "Shopping"],
    [/entertainment\.(museum|culture)|^tourism\.artwork|^commercial\.art|theatre/, "Arts"],
    [/^entertainment|leisure\.(amusement|water_park)|zoo|aquarium/, "Entertainment"],
    [/catering\.(bar|pub)|nightclub/, "Nightlife"],
    [/healthcare|spa|wellness/, "Wellness"],
    [/garden|religion/, "Tranquility"],
    [/^tourism/, "Attractions"],
    [/^public_transport|^transport/, "Transport"],
    [/^accommodation/, "Stay"],
  ];
  return [...new Set(rules.filter(([pattern]) => categories.some((category) => pattern.test(category))).map(([, tag]) => tag))];
}

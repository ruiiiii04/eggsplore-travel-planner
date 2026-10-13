import {
  Building2,
  CarFront,
  Compass,
  Mountain,
  Umbrella,
} from "lucide-react-native";

const icons = {
  beach: Umbrella,
  backpacking: Mountain,
  city: Building2,
  road: CarFront,
};

export function TravelStyleIcon({
  category,
  size = 20,
  color = "#7E49C2",
}: {
  category?: string;
  size?: number;
  color?: string;
}) {
  const Icon = icons[category as keyof typeof icons] ?? Compass;
  return <Icon size={size} color={color} strokeWidth={2} />;
}

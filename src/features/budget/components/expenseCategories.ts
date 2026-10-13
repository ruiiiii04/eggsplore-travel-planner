import {
  BedDouble,
  Camera,
  CarFront,
  CircleEllipsis,
  ShoppingBag,
  Utensils,
  type LucideIcon,
} from "lucide-react-native";
import type { ExpenseCategory } from "../model";

export const EXPENSE_CATEGORIES: {
  key: ExpenseCategory;
  label: string;
  Icon: LucideIcon;
}[] = [
  { key: "food", label: "Food", Icon: Utensils },
  { key: "transport", label: "Transport", Icon: CarFront },
  { key: "stay", label: "Stay", Icon: BedDouble },
  { key: "activities", label: "Activities", Icon: Camera },
  { key: "shopping", label: "Shopping", Icon: ShoppingBag },
  { key: "other", label: "Other", Icon: CircleEllipsis },
];

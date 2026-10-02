import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type TripCreationData = {
  title: string;
  tripType: "solo" | "group" | null;
  destination: string;
  startDate: string;
  endDate: string;
  budget: string;
  preference: string;
  customPreferences: string[];
  invitees: string[];
  tripId: string | null;
};

const initialData: TripCreationData = {
  title: "",
  tripType: "solo",
  destination: "",
  startDate: "",
  endDate: "",
  budget: "RM 2,000 – RM 5,000",
  preference: "Beach Trip",
  customPreferences: [],
  invitees: [],
  tripId: null,
};

type ContextValue = {
  data: TripCreationData;
  update: (changes: Partial<TripCreationData>) => void;
  reset: () => void;
};
const TripCreationContext = createContext<ContextValue | null>(null);

export function TripCreationProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState(initialData);
  const value = useMemo<ContextValue>(() => ({
    data,
    update: (changes) => setData((previous) => ({ ...previous, ...changes })),
    reset: () => setData(initialData),
  }), [data]);
  return <TripCreationContext.Provider value={value}>{children}</TripCreationContext.Provider>;
}

export function useTripCreation() {
  const value = useContext(TripCreationContext);
  if (!value) throw new Error("useTripCreation must be used inside TripCreationProvider");
  return value;
}

import { RoutineDataProvider } from "@/context/RoutineDataContext";
import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <RoutineDataProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="routine/add-diaper" />
        <Stack.Screen name="routine/add-meal" />
      </Stack>
    </RoutineDataProvider>
  );
}

import { AuthSessionProvider } from "@/context/AuthSessionContext";
import { BabySelectionProvider } from "@/context/BabySelectionContext";
import { RoutineDataProvider } from "@/context/RoutineDataContext";
import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <AuthSessionProvider>
      <BabySelectionProvider>
        <RoutineDataProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="routine/add-diaper" />
            <Stack.Screen name="routine/add-meal" />
            <Stack.Screen name="routine/add-sleep" />
          </Stack>
        </RoutineDataProvider>
      </BabySelectionProvider>
    </AuthSessionProvider>
  );
}

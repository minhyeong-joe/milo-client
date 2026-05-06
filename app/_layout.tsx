import { AppPreferencesProvider } from "@/context/AppPreferencesContext";
import { AuthSessionProvider } from "@/context/AuthSessionContext";
import { BabySelectionProvider } from "@/context/BabySelectionContext";
import { RoutineDataProvider } from "@/context/RoutineDataContext";
import { StatusBar } from "expo-status-bar";
import { Stack } from "expo-router";
import { useColorScheme } from "react-native";

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AppPreferencesProvider>
      <AuthSessionProvider>
        <BabySelectionProvider>
          <RoutineDataProvider>
            <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
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
    </AppPreferencesProvider>
  );
}

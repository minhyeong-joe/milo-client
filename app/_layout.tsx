import { AppPreferencesProvider } from "@/context/AppPreferencesContext";
import { AuthSessionProvider } from "@/context/AuthSessionContext";
import { BabySelectionProvider } from "@/context/BabySelectionContext";
import { RoutineDataProvider } from "@/context/RoutineDataContext";
import { SyncProvider } from "@/context/SyncContext";
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
            <SyncProvider>
              <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="baby/add-measurement" />
                <Stack.Screen name="baby/edit-profile" />
                <Stack.Screen name="routine/add-diaper" />
                <Stack.Screen name="routine/add-meal" />
                <Stack.Screen name="routine/add-sleep" />
              </Stack>
            </SyncProvider>
          </RoutineDataProvider>
        </BabySelectionProvider>
      </AuthSessionProvider>
    </AppPreferencesProvider>
  );
}

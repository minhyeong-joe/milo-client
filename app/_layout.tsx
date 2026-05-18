import { AppPreferencesProvider, useAppTheme } from "@/context/AppPreferencesContext";
import { AuthSessionProvider } from "@/context/AuthSessionContext";
import { BabySelectionProvider } from "@/context/BabySelectionContext";
import { DiaryCacheProvider } from "@/context/DiaryCacheContext";
import { GrowthDataProvider } from "@/context/GrowthDataContext";
import { ImmunizationDataProvider } from "@/context/ImmunizationDataContext";
import { RoutineDataProvider } from "@/context/RoutineDataContext";
import { SyncProvider } from "@/context/SyncContext";
import { StatusBar } from "expo-status-bar";
import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <AppPreferencesProvider>
      <ThemedRootLayout />
    </AppPreferencesProvider>
  );
}

function ThemedRootLayout() {
  const { resolvedTheme, themeColors } = useAppTheme();

  return (
      <AuthSessionProvider>
        <BabySelectionProvider>
          <RoutineDataProvider>
            <GrowthDataProvider>
              <ImmunizationDataProvider>
                <DiaryCacheProvider>
                  <SyncProvider>
                    <StatusBar
                      backgroundColor={themeColors.background}
                      style={resolvedTheme === "dark" ? "light" : "dark"}
                      translucent={false}
                    />
                    <Stack
                      screenOptions={{
                        headerShown: false,
                        contentStyle: {
                          backgroundColor: themeColors.background,
                        },
                      }}
                    >
                      <Stack.Screen name="(auth)" />
                      <Stack.Screen name="(tabs)" />
                      <Stack.Screen name="baby/add-measurement" />
                      <Stack.Screen name="baby/edit-profile" />
                      <Stack.Screen name="baby/growth" />
                      <Stack.Screen name="baby/immunization" />
                      <Stack.Screen name="diary/[diaryId]" />
                      <Stack.Screen name="diary/add" />
                      <Stack.Screen name="diary/edit" />
                      <Stack.Screen name="routine/add-diaper" />
                      <Stack.Screen name="routine/add-meal" />
                      <Stack.Screen name="routine/add-sleep" />
                      <Stack.Screen name="settings/account" />
                      <Stack.Screen name="settings/ai-insights" />
                      <Stack.Screen name="settings/backup-export" />
                      <Stack.Screen name="settings/caregivers" />
                      <Stack.Screen name="settings/preferences" />
                      <Stack.Screen name="settings/tags" />
                    </Stack>
                  </SyncProvider>
                </DiaryCacheProvider>
              </ImmunizationDataProvider>
            </GrowthDataProvider>
          </RoutineDataProvider>
        </BabySelectionProvider>
      </AuthSessionProvider>
  );
}

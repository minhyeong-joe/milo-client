import { useAppPreferences } from "@/context/AppPreferencesContext";
import { useAuthSession } from "@/context/AuthSessionContext";
import { colors, globalStyles, spacing, typography } from "@/styles/globalStyles";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SettingsScreen() {
  const router = useRouter();
  const { signOut } = useAuthSession();
  const {
    preferredLengthUnit,
    preferredVolumeUnit,
    preferredWeightUnit,
    setPreferredLengthUnit,
    setPreferredVolumeUnit,
    setPreferredWeightUnit,
  } = useAppPreferences();

  const handleSignOut = async () => {
    await signOut();
    router.replace("/sign-in");
  };

  return (
    <SafeAreaView style={globalStyles.screen}>
      <View style={globalStyles.screenContent}>
        <Text style={globalStyles.titleText}>Settings Screen</Text>
        <Text style={globalStyles.bodyText}>
          Baby profile, AI preferences, app settings, and account settings.
        </Text>
        <View style={styles.settingsCard}>
          <Text style={globalStyles.bodyText}>Unit Preference</Text>
          <View style={styles.settingRow}>
            <Text style={styles.settingTitle}>Volume unit</Text>
            <View style={styles.segmentedControl}>
              <UnitButton
                isSelected={preferredVolumeUnit === "ml"}
                label="mL"
                onPress={() => void setPreferredVolumeUnit("ml")}
              />
              <UnitButton
                isSelected={preferredVolumeUnit === "oz"}
                label="oz"
                onPress={() => void setPreferredVolumeUnit("oz")}
              />
            </View>
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingTitle}>Length unit</Text>
            <View style={styles.segmentedControl}>
              <UnitButton
                isSelected={preferredLengthUnit === "cm"}
                label="cm"
                onPress={() => void setPreferredLengthUnit("cm")}
              />
              <UnitButton
                isSelected={preferredLengthUnit === "in"}
                label="in"
                onPress={() => void setPreferredLengthUnit("in")}
              />
            </View>
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingTitle}>Weight unit</Text>
            <View style={styles.segmentedControl}>
              <UnitButton
                isSelected={preferredWeightUnit === "kg"}
                label="kg"
                onPress={() => void setPreferredWeightUnit("kg")}
              />
              <UnitButton
                isSelected={preferredWeightUnit === "lb"}
                label="lb"
                onPress={() => void setPreferredWeightUnit("lb")}
              />
            </View>
          </View>
        </View>
        <Pressable
          onPress={handleSignOut}
          style={({ pressed }) => [
            styles.signOutButton,
            pressed && styles.pressedButton,
          ]}
        >
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function UnitButton({
  isSelected,
  label,
  onPress,
}: {
  isSelected: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
      style={[styles.unitButton, isSelected && styles.unitButtonSelected]}
    >
      <Text style={[styles.unitButtonText, isSelected && styles.unitButtonTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  segmentedControl: {
    backgroundColor: colors.light.background,
    borderColor: colors.light.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    minWidth: 128,
    padding: 3,
  },
  settingsCard: {
    backgroundColor: colors.light.surface,
    borderColor: colors.light.border,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: spacing.lg,
    padding: spacing.md,
  },
  settingTitle: {
    color: colors.light.textPrimary,
    flex: 1,
    fontSize: 16,
    fontWeight: "800",
  },
  settingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.md,
  },
  signOutButton: {
    alignItems: "center",
    backgroundColor: colors.light.surface,
    borderColor: colors.light.error,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "center",
    marginTop: spacing.lg,
    minHeight: 50,
  },
  pressedButton: {
    opacity: 0.7,
  },
  signOutText: {
    ...typography.label,
    color: colors.light.error,
  },
  unitButton: {
    alignItems: "center",
    borderRadius: 9,
    flex: 1,
    paddingVertical: spacing.sm,
  },
  unitButtonSelected: {
    backgroundColor: colors.light.primary,
  },
  unitButtonText: {
    color: colors.light.textSecondary,
    fontSize: 14,
    fontWeight: "800",
  },
  unitButtonTextSelected: {
    color: colors.light.surface,
  },
});

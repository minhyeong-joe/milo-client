import { useAuthSession } from "@/context/AuthSessionContext";
import { colors, globalStyles, spacing, typography } from "@/styles/globalStyles";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SettingsScreen() {
  const router = useRouter();
  const { signOut } = useAuthSession();

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

const styles = StyleSheet.create({
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
});

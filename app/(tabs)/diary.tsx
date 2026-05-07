import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { globalStyles } from "@/styles/globalStyles";

export default function DiaryScreen() {
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={globalStyles.screen}>
      <View style={globalStyles.screenContent}>
        <Text style={globalStyles.titleText}>Diary Screen</Text>
        <Text style={globalStyles.bodyText}>
          Freeform memories, tags, media, and AI insights.
        </Text>
      </View>
    </SafeAreaView>
  );
}

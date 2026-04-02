import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function EditorScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Editor</Text>
      <Text style={styles.text}>
        Próximo paso: importar video/foto, timeline y exportación.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: "#0D0F13" },
  title: { fontSize: 28, fontWeight: "800", color: "#FFB13E" },
  text: { marginTop: 10, fontSize: 16, color: "#F2F3F5", opacity: 0.85 },
});

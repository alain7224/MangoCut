import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";

export default function Home() {
  return (
    <View style={styles.container}>
      <Text style={styles.brand}>MangoCut</Text>
      <Text style={styles.subtitle}>Editor de foto y video</Text>

      <Pressable
        onPress={() => router.push("/editor")}
        style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
      >
        <Text style={styles.primaryBtnText}>Nuevo proyecto</Text>
      </Pressable>

      <Pressable
        onPress={() => router.push("/projects")}
        style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.9 }]}
      >
        <Text style={styles.secondaryBtnText}>Mis proyectos</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: "center", backgroundColor: "#0D0F13" },
  brand: { fontSize: 44, fontWeight: "800", color: "#FFB13E", letterSpacing: 0.5 },
  subtitle: { marginTop: 6, marginBottom: 26, fontSize: 16, color: "#F2F3F5", opacity: 0.85 },
  primaryBtn: {
    backgroundColor: "#FF8A00",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  primaryBtnText: { color: "#0D0F13", fontWeight: "800", fontSize: 16 },
  secondaryBtn: { marginTop: 12, borderWidth: 1, borderColor: "#2A2D34", paddingVertical: 14, borderRadius: 16, alignItems: "center" },
  secondaryBtnText: { color: "#F2F3F5", fontWeight: "700", fontSize: 15 },
});

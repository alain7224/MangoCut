import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { templates } from "../templates";

export default function HomeScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#06090F", "#08111E", "#05070C"]}
        style={styles.bg}
      />

      <View style={styles.brandBar}>
        <Text style={styles.logo}>MangoCut</Text>
        <Text style={styles.tag}>Editor visual pro</Text>
      </View>

      <View style={styles.hero}>
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Crea vídeos, reels y montajes con tu estilo</Text>
          <Text style={styles.heroText}>
            Editor multipista con fotos, vídeos, audio, transiciones y formato social.
          </Text>

          <View style={styles.heroButtons}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => navigation.navigate("Editor", { templateName: "Sin plantilla" })}
            >
              <Text style={styles.primaryBtnText}>Nuevo proyecto</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => navigation.navigate("Editor", { templateName: "Loop infinito" })}
            >
              <Text style={styles.secondaryBtnText}>Abrir editor</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.templatesWrap}>
        <Text style={styles.sectionTitle}>Plantillas rápidas</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.templatesRow}>
          {templates.map((item) => (
            <TouchableOpacity
              key={item.name}
              style={styles.templateCard}
              onPress={() => navigation.navigate("Editor", { templateName: item.name })}
            >
              <View style={styles.templateAccent} />
              <Text style={styles.templateTitle}>{item.name}</Text>
              <Text style={styles.templateText}>
                {item.description || "Abrir base visual y empezar a editar"}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#04070D" },
  bg: { ...StyleSheet.absoluteFillObject },
  brandBar: { paddingTop: 24, paddingHorizontal: 18, paddingBottom: 8 },
  logo: { color: "#FFA629", fontSize: 44, fontWeight: "900", letterSpacing: 0.3 },
  tag: { color: "rgba(245,247,250,0.68)", fontSize: 16, marginTop: 4, fontWeight: "600" },
  hero: { paddingHorizontal: 18, paddingTop: 10 },
  heroCard: {
    borderRadius: 26,
    padding: 22,
    backgroundColor: "rgba(10,16,30,0.88)",
    borderWidth: 1,
    borderColor: "#17223A",
    minHeight: 220,
    justifyContent: "center",
  },
  heroTitle: { color: "#F5F7FA", fontSize: 30, fontWeight: "900", lineHeight: 36, maxWidth: 760 },
  heroText: { color: "#9BA7BC", fontSize: 16, lineHeight: 22, marginTop: 10, maxWidth: 760 },
  heroButtons: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 20 },
  primaryBtn: { backgroundColor: "#FF9500", paddingHorizontal: 20, paddingVertical: 14, borderRadius: 18 },
  primaryBtnText: { color: "#0B0D12", fontWeight: "900", fontSize: 16 },
  secondaryBtn: {
    backgroundColor: "#10182B",
    borderWidth: 1,
    borderColor: "#1C2440",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 18,
  },
  secondaryBtnText: { color: "#F5F7FA", fontWeight: "800", fontSize: 16 },
  templatesWrap: { paddingTop: 22, paddingHorizontal: 18 },
  sectionTitle: { color: "#F5F7FA", fontSize: 18, fontWeight: "900", marginBottom: 12 },
  templatesRow: { gap: 14, paddingBottom: 22 },
  templateCard: {
    width: 250,
    minHeight: 130,
    borderRadius: 22,
    padding: 18,
    backgroundColor: "rgba(10,16,30,0.92)",
    borderWidth: 1,
    borderColor: "#17223A",
  },
  templateAccent: { width: 8, height: 42, borderRadius: 99, backgroundColor: "#FF9500", marginBottom: 12 },
  templateTitle: { color: "#F5F7FA", fontWeight: "900", fontSize: 18 },
  templateText: { color: "#97A2B6", fontSize: 14, marginTop: 8, lineHeight: 19 },
});

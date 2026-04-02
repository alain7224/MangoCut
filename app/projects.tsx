import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function ProjectsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mis proyectos</Text>
      <Text style={styles.text}>
        Próximo paso: aquí aparecerán tus proyectos guardados para que al reiniciar NO pierdas nada.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: "#0D0F13" },
  title: { fontSize: 28, fontWeight: "800", color: "#FFB13E" },
  text: { marginTop: 10, fontSize: 16, color: "#F2F3F5", opacity: 0.85 },
});

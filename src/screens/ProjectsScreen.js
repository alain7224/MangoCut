import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { loadProjects } from "../utils/storage";

export default function ProjectsScreen({ navigation }) {
  const [projects, setProjects] = useState([]);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      loadProjects().then((items) => {
        if (mounted) setProjects(items);
      });
      return () => {
        mounted = false;
      };
    }, [])
  );

  return (
    <View style={styles.container}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Mis proyectos</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {projects.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Todavía no hay proyectos guardados</Text>
            <Text style={styles.emptySub}>Abre el editor, importa un archivo y pulsa Guardar proyecto.</Text>
          </View>
        ) : (
          projects.map((project) => (
            <TouchableOpacity
              key={project.id}
              style={styles.projectCard}
              onPress={() => navigation.navigate("Editor", { restoreProjectId: project.id })}
            >
              <Text style={styles.projectTitle}>{project.name || "Proyecto sin nombre"}</Text>
              <Text style={styles.projectSub}>
                {project.templateName || "Sin plantilla"} · {project.mediaType || "Sin media"}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#05070D" },
  topbar: {
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1B233B"
  },
  backBtn: {
    alignSelf: "flex-start",
    marginBottom: 10
  },
  backText: {
    color: "#FFA629",
    fontWeight: "800",
    fontSize: 16
  },
  title: {
    color: "#F5F7FA",
    fontSize: 28,
    fontWeight: "900"
  },
  content: {
    padding: 18
  },
  emptyCard: {
    backgroundColor: "#0A1022",
    borderColor: "#1C2440",
    borderWidth: 1,
    borderRadius: 24,
    padding: 18
  },
  emptyTitle: {
    color: "#F5F7FA",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 8
  },
  emptySub: {
    color: "#A3ABBA",
    fontSize: 16
  },
  projectCard: {
    backgroundColor: "#0A1022",
    borderColor: "#1C2440",
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    marginBottom: 12
  },
  projectTitle: {
    color: "#F5F7FA",
    fontSize: 22,
    fontWeight: "800"
  },
  projectSub: {
    color: "#A3ABBA",
    marginTop: 6,
    fontSize: 15
  }
});

import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, FlatList } from "react-native";
import { router } from "expo-router";
import { createProject, listProjects, deleteProject } from "@/src/core/projectStore";
import { Project } from "@/src/core/types";

export default function ProjectsTab() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const items = await listProjects();
    setProjects(items);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function onNewProject() {
    const p = await createProject();
    await refresh();
    router.push({ pathname: "/editor", params: { projectId: p.id } });
  }

  async function onDelete(id: string) {
    await deleteProject(id);
    await refresh();
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Proyectos</Text>

      <Pressable onPress={onNewProject} style={styles.primaryBtn}>
        <Text style={styles.primaryBtnText}>+ Nuevo proyecto</Text>
      </Pressable>

      {loading ? (
        <Text style={styles.text}>Cargando…</Text>
      ) : projects.length === 0 ? (
        <Text style={styles.text}>Todavía no hay proyectos.</Text>
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 24 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Pressable
                onPress={() => router.push({ pathname: "/editor", params: { projectId: item.id } })}
                style={{ flex: 1 }}
              >
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardSub}>
                  {item.items.length} media • {new Date(item.updatedAt).toLocaleString()}
                </Text>
              </Pressable>

              <Pressable onPress={() => onDelete(item.id)} style={styles.deleteBtn}>
                <Text style={styles.deleteText}>Borrar</Text>
              </Pressable>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#0D0F13" },
  title: { fontSize: 28, fontWeight: "800", color: "#FFB13E" },
  text: { marginTop: 12, fontSize: 16, color: "#F2F3F5", opacity: 0.85 },

  primaryBtn: {
    marginTop: 14,
    backgroundColor: "#FF8A00",
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
  },
  primaryBtnText: { color: "#0D0F13", fontWeight: "900", fontSize: 16 },

  card: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#121520",
    borderWidth: 1,
    borderColor: "#252A35",
    marginBottom: 10,
    alignItems: "center",
  },
  cardTitle: { color: "#F2F3F5", fontWeight: "800", fontSize: 16 },
  cardSub: { marginTop: 4, color: "#A7B0BE", fontSize: 13 },

  deleteBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "#2A1A1A",
    borderWidth: 1,
    borderColor: "#5A1E1E",
  },
  deleteText: { color: "#FF6B6B", fontWeight: "800" },
});

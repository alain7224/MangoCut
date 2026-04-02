import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, FlatList } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Video } from "expo-av";

import { getProject } from "@/src/core/projectStore";
import { importIntoProject } from "@/src/core/mediaImport";
import { Project, ProjectMediaItem } from "@/src/core/types";

export default function EditorTab() {
  const params = useLocalSearchParams<{ projectId?: string }>();
  const projectId = params.projectId;

  const [project, setProject] = useState<Project | null>(null);
  const [selected, setSelected] = useState<ProjectMediaItem | null>(null);

  useEffect(() => {
    (async () => {
      if (!projectId) {
        setProject(null);
        setSelected(null);
        return;
      }
      const p = await getProject(projectId);
      setProject(p);
      setSelected(p?.items?.[0] ?? null);
    })();
  }, [projectId]);

  const title = useMemo(() => {
    if (!projectId) return "Editor";
    if (!project) return "Editor (cargando…)";
    return `Editor: ${project.name}`;
  }, [projectId, project]);

  async function onImport() {
    if (!project) return;
    const updated = await importIntoProject(project);
    setProject(updated);
    if (!selected && updated.items[0]) setSelected(updated.items[0]);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>

      {!projectId ? (
        <Text style={styles.text}>Ve a “Proyectos” y crea/abre uno.</Text>
      ) : !project ? (
        <Text style={styles.text}>No encontré el proyecto. Vuelve a “Proyectos”.</Text>
      ) : (
        <>
          <Pressable onPress={onImport} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Importar video / foto / audio</Text>
          </Pressable>

          <View style={styles.preview}>
            {selected?.kind === "video" ? (
              <Video
                style={{ width: "100%", height: "100%" }}
                source={{ uri: selected.uri }}
                useNativeControls
                resizeMode="contain"
              />
            ) : selected ? (
              <Text style={styles.previewText}>
                Seleccionado: {selected.kind} • {selected.name}
              </Text>
            ) : (
              <Text style={styles.previewText}>Importa un archivo para empezar.</Text>
            )}
          </View>

          <Text style={styles.section}>Timeline (MVP)</Text>
          <FlatList
            horizontal
            data={project.items}
            keyExtractor={(i) => i.id}
            contentContainerStyle={{ paddingVertical: 10 }}
            renderItem={({ item }) => {
              const active = item.id === selected?.id;
              return (
                <Pressable
                  onPress={() => setSelected(item)}
                  style={[styles.clip, active && styles.clipActive]}
                >
                  <Text style={styles.clipText}>{item.kind}</Text>
                  <Text style={styles.clipSub} numberOfLines={1}>{item.name}</Text>
                </Pressable>
              );
            }}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#0D0F13" },
  title: { fontSize: 22, fontWeight: "900", color: "#FFB13E" },
  text: { marginTop: 12, fontSize: 16, color: "#F2F3F5", opacity: 0.85 },

  primaryBtn: {
    marginTop: 14,
    backgroundColor: "#FF8A00",
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
  },
  primaryBtnText: { color: "#0D0F13", fontWeight: "900", fontSize: 16 },

  preview: {
    marginTop: 12,
    height: 240,
    borderRadius: 16,
    backgroundColor: "#121520",
    borderWidth: 1,
    borderColor: "#252A35",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  previewText: { color: "#A7B0BE", paddingHorizontal: 12, textAlign: "center" },

  section: { marginTop: 14, color: "#F2F3F5", fontWeight: "800" },

  clip: {
    width: 160,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#121520",
    borderWidth: 1,
    borderColor: "#252A35",
    marginRight: 10,
  },
  clipActive: { borderColor: "#FFB13E" },
  clipText: { color: "#FFB13E", fontWeight: "900" },
  clipSub: { marginTop: 4, color: "#A7B0BE", fontSize: 12 },
});

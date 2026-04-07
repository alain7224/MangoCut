import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Modal,
  Pressable,
  Animated,
  ActivityIndicator,
  Alert,
  Platform,
  PanResponder,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useEventListener } from "expo";
import { VideoView, useVideoPlayer } from "expo-video";
import { transitions } from "../data/editorData";
import { saveEditorProject, loadEditorProject } from "../utils/projectStorage";

const IMAGE_DEFAULT_DURATION = 2500;
const THUMB_W = 104;
const THUMB_H = 70;

const FORMATS = {
  "9:16": 9 / 16,
  "1:1": 1,
  "16:9": 16 / 9,
  "4:5": 4 / 5,
};

const BG_VIDEO =
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4";

function makeId() {
  return "clip_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
}

function ProButton({ title, onPress, primary = false, compact = false }) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: false,
      speed: 28,
      bounciness: 4,
    }).start();
  };

  const pressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: false,
      speed: 28,
      bounciness: 6,
    }).start();
  };

  return (
    <Pressable onPress={onPress} onPressIn={pressIn} onPressOut={pressOut}>
      <Animated.View style={{ transform: [{ scale }] }}>
        {primary ? (
          <LinearGradient
            colors={["#FFB84D", "#FF8A00"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.primaryBtn, compact && styles.compactBtn]}
          >
            <Text style={styles.primaryBtnText}>{title}</Text>
          </LinearGradient>
        ) : (
          <View style={[styles.secondaryBtn, compact && styles.compactBtn]}>
            <Text style={styles.secondaryBtnText}>{title}</Text>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

function TimelineClip({
  clip,
  index,
  isSelected,
  isCurrent,
  onSelect,
  onMoveBy,
}) {
  const dragX = useRef(new Animated.Value(0)).current;

  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderGrant: () => {
        dragX.setValue(0);
      },
      onPanResponderMove: (_, gesture) => {
        dragX.setValue(gesture.dx);
      },
      onPanResponderRelease: (_, gesture) => {
        const step = THUMB_W;
        const delta = Math.round(gesture.dx / step);

        Animated.spring(dragX, {
          toValue: 0,
          useNativeDriver: false,
          speed: 30,
          bounciness: 6,
        }).start();

        if (delta !== 0) {
          onMoveBy(index, delta);
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(dragX, {
          toValue: 0,
          useNativeDriver: false,
          speed: 30,
          bounciness: 6,
        }).start();
      },
    })
  ).current;

  return (
    <Animated.View
      style={[styles.clipItem, { transform: [{ translateX: dragX }] }]}
      {...responder.panHandlers}
    >
      <TouchableOpacity
        style={[
          styles.thumb,
          isSelected && styles.thumbSelected,
          isCurrent && styles.thumbCurrent,
        ]}
        onPress={onSelect}
      >
        {clip.type === "image" ? (
          <Image source={{ uri: clip.uri }} style={styles.thumbImage} />
        ) : (
          <View style={styles.thumbVideo}>
            <Text style={styles.thumbVideoText}>▶</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

function AudioWave({ active }) {
  const bars = new Array(72).fill(0).map((_, i) => {
    const heights = [18, 24, 14, 30, 10, 22, 28, 12];
    return heights[i % heights.length];
  });

  return (
    <View style={styles.audioWaveWrap}>
      {bars.map((h, i) => (
        <View
          key={i}
          style={[
            styles.audioBar,
            {
              height: h,
              backgroundColor: active ? "#22C55E" : "#33405E",
            },
          ]}
        />
      ))}
    </View>
  );
}

export default function EditorScreen({ navigation, route }) {
  const templateName = route?.params?.templateName || "Sin plantilla";

  const [clips, setClips] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  const [transitionModalVisible, setTransitionModalVisible] = useState(false);
  const [editingGapIndex, setEditingGapIndex] = useState(0);
  const [transitionsByGap, setTransitionsByGap] = useState({});
  const [formatKey, setFormatKey] = useState("16:9");

  const [audioTrack, setAudioTrack] = useState(null);
  const [isPreparingNext, setIsPreparingNext] = useState(false);

  const imageTimerRef = useRef(null);
  const webAudioRef = useRef(null);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  const currentClip = clips[currentIndex] || null;
  const selectedClip = clips[selectedIndex] || null;

  const bgPlayer = useVideoPlayer({ uri: BG_VIDEO }, (player) => {
    player.loop = true;
    player.muted = true;
    player.play();
  });

  const mediaPlayer = useVideoPlayer(null);

  useEventListener(mediaPlayer, "playToEnd", () => {
    advanceToNext();
  });

  const clearImageTimer = () => {
    if (imageTimerRef.current) {
      clearTimeout(imageTimerRef.current);
      imageTimerRef.current = null;
    }
  };

  const showPreparingOverlay = () => {
    setIsPreparingNext(true);
    overlayOpacity.setValue(0);
    Animated.timing(overlayOpacity, {
      toValue: 1,
      duration: 120,
      useNativeDriver: true,
    }).start();
  };

  const hidePreparingOverlay = () => {
    Animated.timing(overlayOpacity, {
      toValue: 0,
      duration: 120,
      useNativeDriver: true,
    }).start(() => {
      setIsPreparingNext(false);
    });
  };

  const runSimpleTransition = () => {
    fadeAnim.setValue(0.42);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
  };

  const syncWebAudio = () => {
    if (Platform.OS !== "web") return;
    if (!audioTrack?.uri) return;

    if (!webAudioRef.current) {
      webAudioRef.current = new Audio(audioTrack.uri);
      webAudioRef.current.loop = true;
      webAudioRef.current.volume = 0.9;
    } else if (webAudioRef.current.src !== audioTrack.uri) {
      webAudioRef.current.pause();
      webAudioRef.current = new Audio(audioTrack.uri);
      webAudioRef.current.loop = true;
      webAudioRef.current.volume = 0.9;
    }

    if (isPlaying) {
      webAudioRef.current.play().catch(() => {});
    } else {
      webAudioRef.current.pause();
    }
  };

  useEffect(() => {
    syncWebAudio();
  }, [audioTrack, isPlaying]);

  const buildProjectPayload = () => ({
    templateName,
    clips,
    selectedIndex,
    currentIndex,
    transitionsByGap,
    formatKey,
    audioTrack,
    createdAt: new Date().toISOString(),
  });

  const handleSaveProject = async () => {
    try {
      await saveEditorProject(buildProjectPayload());
      Alert.alert("Guardado", "Proyecto guardado correctamente.");
    } catch (e) {
      Alert.alert("Error", "No se pudo guardar el proyecto.");
    }
  };

  const handleLoadProject = async () => {
    try {
      const project = await loadEditorProject();
      if (!project) {
        Alert.alert("Vacío", "No hay proyecto guardado.");
        return;
      }

      setClips(project.clips || []);
      setSelectedIndex(project.selectedIndex || 0);
      setCurrentIndex(project.currentIndex || 0);
      setTransitionsByGap(project.transitionsByGap || {});
      setFormatKey(project.formatKey || "16:9");
      setAudioTrack(project.audioTrack || null);
      Alert.alert("Cargado", "Proyecto restaurado.");
    } catch (e) {
      Alert.alert("Error", "No se pudo cargar el proyecto.");
    }
  };

  const advanceToNext = async () => {
    if (!clips.length) return;

    const nextIndex = currentIndex < clips.length - 1 ? currentIndex + 1 : 0;
    const nextClip = clips[nextIndex];

    clearImageTimer();

    if (!nextClip) return;

    if (nextClip.type === "video" && nextClip.uri) {
      try {
        showPreparingOverlay();
        await mediaPlayer.replaceAsync({ uri: nextClip.uri });
        mediaPlayer.currentTime = 0;

        setCurrentIndex(nextIndex);
        setSelectedIndex(nextIndex);

        if (isPlaying) mediaPlayer.play();

        setTimeout(() => {
          hidePreparingOverlay();
        }, 100);
        return;
      } catch (e) {
        console.log("Error preparando siguiente video:", e);
        hidePreparingOverlay();
        return;
      }
    }

    setCurrentIndex(nextIndex);
    setSelectedIndex(nextIndex);

    if (transitionsByGap[currentIndex]) {
      runSimpleTransition();
    }
  };

  useEffect(() => {
    let cancelled = false;

    const prepareCurrentClip = async () => {
      clearImageTimer();

      if (!currentClip) {
        try {
          mediaPlayer.pause();
        } catch (e) {}
        return;
      }

      if (!isPlaying) {
        try {
          mediaPlayer.pause();
        } catch (e) {}
        return;
      }

      if (currentClip.type === "image") {
        try {
          mediaPlayer.pause();
        } catch (e) {}

        imageTimerRef.current = setTimeout(() => {
          if (!cancelled) advanceToNext();
        }, currentClip.duration || IMAGE_DEFAULT_DURATION);
        return;
      }

      if (currentClip.type === "video" && currentClip.uri) {
        try {
          await mediaPlayer.replaceAsync({ uri: currentClip.uri });
          if (cancelled) return;
          mediaPlayer.currentTime = 0;
          mediaPlayer.play();
        } catch (e) {
          console.log("Error cargando video:", e);
        }
      }
    };

    prepareCurrentClip();

    return () => {
      cancelled = true;
      clearImageTimer();
    };
  }, [currentIndex, currentClip?.uri, currentClip?.type, currentClip?.duration, isPlaying]);

  const importMedia = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsMultipleSelection: true,
      orderedSelection: true,
      quality: 1,
      selectionLimit: 15,
    });

    if (result.canceled || !result.assets?.length) return;

    const incoming = result.assets.map((asset) => ({
      id: makeId(),
      uri: asset.uri,
      type: asset.type || "image",
      duration: asset.type === "image" ? IMAGE_DEFAULT_DURATION : asset.duration || null,
    }));

    setClips((prev) => {
      const next = [...prev, ...incoming].slice(0, 15);
      if (prev.length === 0 && next.length > 0) {
        setSelectedIndex(0);
        setCurrentIndex(0);
      }
      return next;
    });
  };

  const importAudio = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "audio/*",
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.length) return;

      const track = {
        name: result.assets[0].name || "Audio",
        uri: result.assets[0].uri,
      };

      setAudioTrack(track);

      if (Platform.OS === "web") {
        setTimeout(() => {
          if (!webAudioRef.current || webAudioRef.current.src !== track.uri) {
            webAudioRef.current = new Audio(track.uri);
            webAudioRef.current.loop = true;
            webAudioRef.current.volume = 0.9;
          }
          if (isPlaying) {
            webAudioRef.current.play().catch(() => {});
          }
        }, 50);
      }
    } catch (e) {
      Alert.alert("Error", "No se pudo cargar el audio.");
    }
  };

  const downloadProject = async () => {
    const payload = buildProjectPayload();

    if (Platform.OS === "web") {
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "mangocut-project.json";
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    Alert.alert("Descargar", "Ahora mismo descarga el proyecto. La exportación final viene después.");
  };

  const removeSelected = () => {
    if (!clips.length) return;

    const idx = selectedIndex;
    const next = clips.filter((_, i) => i !== idx);

    const rebuiltTransitions = {};
    for (let i = 0; i < next.length - 1; i++) {
      rebuiltTransitions[i] = transitionsByGap[i] || "";
    }

    setClips(next);
    setTransitionsByGap(rebuiltTransitions);

    if (!next.length) {
      setSelectedIndex(0);
      setCurrentIndex(0);
      return;
    }

    const safe = Math.max(0, Math.min(idx, next.length - 1));
    setSelectedIndex(safe);
    setCurrentIndex(safe);
  };

  const moveClipByDrag = (fromIndex, delta) => {
    if (!clips.length) return;

    const toIndex = Math.max(0, Math.min(fromIndex + delta, clips.length - 1));
    if (toIndex === fromIndex) return;

    const next = [...clips];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);

    setClips(next);
    setSelectedIndex(toIndex);
    setCurrentIndex((prev) => {
      if (prev === fromIndex) return toIndex;
      return prev;
    });
  };

  const moveLeft = () => {
    moveClipByDrag(selectedIndex, -1);
  };

  const moveRight = () => {
    moveClipByDrag(selectedIndex, 1);
  };

  const setImageDuration = (ms) => {
    if (!selectedClip || selectedClip.type !== "image") return;
    setClips((prev) =>
      prev.map((clip, i) => (i === selectedIndex ? { ...clip, duration: ms } : clip))
    );
  };

  const openGapEditor = (gapIndex) => {
    setEditingGapIndex(gapIndex);
    setTransitionModalVisible(true);
  };

  const setTransitionForGap = (name) => {
    setTransitionsByGap((prev) => ({
      ...prev,
      [editingGapIndex]: name,
    }));
    setTransitionModalVisible(false);
  };

  const applyTransitionToAll = (name) => {
    const next = {};
    for (let i = 0; i < clips.length - 1; i++) {
      next[i] = name;
    }
    setTransitionsByGap(next);
    setTransitionModalVisible(false);
  };

  const togglePlay = () => {
    setIsPlaying((v) => !v);
  };

  const goPrevManual = () => {
    if (!clips.length || currentIndex <= 0) return;
    setCurrentIndex((v) => v - 1);
    setSelectedIndex((v) => Math.max(v - 1, 0));
  };

  const goNextManual = () => {
    if (!clips.length || currentIndex >= clips.length - 1) return;
    setCurrentIndex((v) => v + 1);
    setSelectedIndex((v) => Math.min(v + 1, clips.length - 1));
  };

  const previewAspectRatio = FORMATS[formatKey];
  const hasSequence = clips.length > 0;

  return (
    <View style={styles.container}>
      <View style={styles.bgVideoWrap}>
        <VideoView
          player={bgPlayer}
          style={styles.bgVideo}
          contentFit="cover"
          nativeControls={false}
        />
        <View style={styles.bgOverlay} />
      </View>

      <Text style={styles.editorMiniLogo}>MangoCut</Text>

      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>

        <View style={styles.topMeta}>
          <Text style={styles.headerTitle}>{templateName}</Text>
          <Text style={styles.headerSub}>Editor visual</Text>
        </View>
      </View>

      <View style={styles.previewSection}>
        <View style={[styles.previewInner, { aspectRatio: previewAspectRatio }]}>
          {!currentClip ? (
            <View style={styles.emptyPreview}>
              <Text style={styles.previewTitle}>Vista previa</Text>
              <Text style={styles.previewSub}>Carga fotos, vídeos y audio para empezar</Text>
            </View>
          ) : (
            <Animated.View style={[styles.layer, { opacity: fadeAnim }]}>
              {currentClip.type === "video" ? (
                <VideoView
                  player={mediaPlayer}
                  style={styles.previewMedia}
                  contentFit="contain"
                  nativeControls
                />
              ) : (
                <Image
                  source={{ uri: currentClip.uri }}
                  style={styles.previewMedia}
                  resizeMode="contain"
                />
              )}
            </Animated.View>
          )}

          {isPreparingNext && (
            <Animated.View style={[styles.loadingOverlay, { opacity: overlayOpacity }]}>
              <ActivityIndicator size="small" color="#22C55E" />
              <Text style={styles.loadingText}>Preparando clip…</Text>
            </Animated.View>
          )}
        </View>

        {hasSequence && (
          <TouchableOpacity style={styles.floatingPlay} onPress={togglePlay}>
            <LinearGradient
              colors={isPlaying ? ["#22C55E", "#169B58"] : ["#FFB84D", "#FF8A00"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.floatingPlayInner}
            >
              <Text style={styles.floatingPlayText}>{isPlaying ? "PAUSA" : "PLAY"}</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.dockArea}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.formatRow}>
          {Object.keys(FORMATS).map((key) => {
            const active = formatKey === key;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.formatChip, active && styles.formatChipActive]}
                onPress={() => setFormatKey(key)}
              >
                <Text style={[styles.formatChipText, active && styles.formatChipTextActive]}>
                  {key}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.actionPanel}>
          <View style={styles.toolbarRow}>
            <ProButton title="Importar" onPress={importMedia} primary />
            <ProButton title="Sonido" onPress={importAudio} />
            <ProButton title="Guardar" onPress={handleSaveProject} />
            <ProButton title="Cargar" onPress={handleLoadProject} />
            <ProButton title="Descargar" onPress={downloadProject} />
            <ProButton title="Borrar" onPress={removeSelected} />
          </View>

          <View style={styles.toolbarRow}>
            <ProButton title="← Mover" onPress={moveLeft} compact />
            <ProButton title="Mover →" onPress={moveRight} compact />
            <ProButton title="0.3 s" onPress={() => setImageDuration(300)} compact />
            <ProButton title="1 s" onPress={() => setImageDuration(1000)} compact />
            <ProButton title="3 s" onPress={() => setImageDuration(3000)} compact />
            <ProButton title="5 s" onPress={() => setImageDuration(5000)} compact />
          </View>
        </View>

        <View style={styles.audioLaneWrap}>
          <Text style={styles.audioLabel}>
            {audioTrack ? `Audio: ${audioTrack.name}` : "Audio: no cargado"}
          </Text>
          <View style={styles.audioLane}>
            <View style={[styles.audioFill, audioTrack && styles.audioFillLoaded]} />
          </View>
        </View>

        <View style={styles.transportRow}>
          <TouchableOpacity style={styles.transportBtn} onPress={goPrevManual}>
            <Text style={styles.transportBtnText}>◀</Text>
          </TouchableOpacity>
          <Text style={styles.metaText}>
            Clip {clips.length ? currentIndex + 1 : 0} / {clips.length}
          </Text>
          <TouchableOpacity style={styles.transportBtn} onPress={goNextManual}>
            <Text style={styles.transportBtnText}>▶</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.timelinePanel}>
          <Text style={styles.trackLabel}>PISTA MEDIA</Text>

          <View style={styles.timelineViewport}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={true}
              contentContainerStyle={styles.timelineRow}
            >
              {clips.length === 0 ? (
                <View style={styles.emptyTimeline}>
                  <Text style={styles.emptyTimelineText}>Sin clips</Text>
                </View>
              ) : (
                clips.map((clip, index) => {
                  const hasTransition = !!transitionsByGap[index];
                  const isSelected = selectedIndex === index;
                  const isCurrent = currentIndex === index;

                  return (
                    <React.Fragment key={clip.id}>
                      <TimelineClip
                        clip={clip}
                        index={index}
                        isSelected={isSelected}
                        isCurrent={isCurrent}
                        onSelect={() => {
                          setSelectedIndex(index);
                          setCurrentIndex(index);
                        }}
                        onMoveBy={moveClipByDrag}
                      />

                      {index < clips.length - 1 && (
                        <TouchableOpacity
                          style={[
                            styles.transitionSeam,
                            hasTransition ? styles.transitionSeamActive : styles.transitionSeamIdle,
                          ]}
                          onPress={() => openGapEditor(index)}
                        >
                          <Text style={styles.transitionSeamText}>
                            {hasTransition ? "FX" : "+"}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </ScrollView>
          </View>

          <Text style={[styles.trackLabel, { marginTop: 10 }]}>PISTA AUDIO</Text>
          <View style={styles.audioTrackBlock}>
            <AudioWave active={!!audioTrack} />
          </View>
        </View>
      </View>

      <Modal visible={transitionModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Transición entre clip {editingGapIndex + 1} y {editingGapIndex + 2}
            </Text>

            <ScrollView style={{ maxHeight: 320 }}>
              {transitions.map((name) => {
                const active = transitionsByGap[editingGapIndex] === name;
                return (
                  <TouchableOpacity
                    key={name}
                    style={[styles.modalItem, active && styles.modalItemActive]}
                    onPress={() => setTransitionForGap(name)}
                  >
                    <Text style={[styles.modalItemText, active && styles.modalItemTextActive]}>
                      {name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity style={styles.applyAllBtn} onPress={() => applyTransitionToAll("Dissolve Pro")}>
              <Text style={styles.applyAllText}>Aplicar Dissolve a todas</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.applyAllBtn} onPress={() => applyTransitionToAll("Push Left")}>
              <Text style={styles.applyAllText}>Aplicar Push Left a todas</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.closeBtn} onPress={() => setTransitionModalVisible(false)}>
              <Text style={styles.closeText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#03050A",
    paddingTop: 6,
  },
  bgVideoWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  bgVideo: {
    width: "100%",
    height: "100%",
    opacity: 0.08,
  },
  bgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2,4,10,0.9)",
  },
  editorMiniLogo: {
    position: "absolute",
    top: 18,
    right: 16,
    color: "rgba(255,166,41,0.18)",
    fontSize: 34,
    fontWeight: "900",
    zIndex: 1,
    letterSpacing: 0.3,
  },
  topbar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 8,
    zIndex: 3,
  },
  backBtn: {
    paddingVertical: 8,
    paddingRight: 10,
  },
  backText: {
    color: "#FFA629",
    fontWeight: "800",
    fontSize: 15,
  },
  topMeta: {
    flex: 1,
  },
  headerTitle: {
    color: "#F5F7FA",
    fontSize: 18,
    fontWeight: "900",
  },
  headerSub: {
    color: "#8FA0BB",
    fontSize: 12,
    marginTop: 2,
  },
  previewSection: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    height: 250,
  },
  previewInner: {
    width: "100%",
    height: "100%",
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "rgba(8,14,28,0.96)",
    borderWidth: 1,
    borderColor: "#1C2440",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
  },
  previewMedia: {
    width: "100%",
    height: "100%",
    maxWidth: "100%",
    maxHeight: "100%",
  },
  emptyPreview: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  previewTitle: {
    color: "#F5F7FA",
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 6,
  },
  previewSub: {
    color: "#9DA8BB",
    fontSize: 15,
    textAlign: "center",
  },
  loadingOverlay: {
    position: "absolute",
    inset: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(3,5,10,0.34)",
    zIndex: 6,
  },
  loadingText: {
    color: "#F5F7FA",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 10,
  },
  floatingPlay: {
    position: "absolute",
    right: 22,
    top: 20,
    zIndex: 20,
  },
  floatingPlayInner: {
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  floatingPlayText: {
    color: "#04130A",
    fontWeight: "900",
    fontSize: 13,
  },
  dockArea: {
    flex: 1,
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 20,
    backgroundColor: "rgba(7,11,20,0.98)",
    borderWidth: 1,
    borderColor: "#16203A",
    padding: 10,
    overflow: "hidden",
    minHeight: 320,
  },
  formatRow: {
    gap: 8,
    paddingBottom: 6,
  },
  formatChip: {
    backgroundColor: "#10182B",
    borderColor: "#1C2440",
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  formatChipActive: {
    backgroundColor: "#22C55E",
    borderColor: "#22C55E",
  },
  formatChipText: {
    color: "#E8ECF3",
    fontWeight: "800",
    fontSize: 12,
  },
  formatChipTextActive: {
    color: "#04130A",
  },
  actionPanel: {
    marginTop: 2,
  },
  toolbarRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingTop: 8,
  },
  primaryBtn: {
    borderRadius: 18,
    paddingVertical: 11,
    paddingHorizontal: 15,
  },
  primaryBtnText: {
    color: "#0B0D12",
    fontWeight: "900",
    fontSize: 13,
  },
  secondaryBtn: {
    backgroundColor: "#10182B",
    borderColor: "#1C2440",
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  secondaryBtnText: {
    color: "#E8ECF3",
    fontWeight: "800",
    fontSize: 13,
  },
  compactBtn: {
    paddingVertical: 9,
    paddingHorizontal: 11,
  },
  audioLaneWrap: {
    paddingTop: 8,
  },
  audioLabel: {
    color: "#9BA6B9",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
  },
  audioLane: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#0D1320",
    borderWidth: 1,
    borderColor: "#1C2440",
    overflow: "hidden",
  },
  audioFill: {
    width: "12%",
    height: "100%",
    backgroundColor: "#2B354E",
  },
  audioFillLoaded: {
    width: "88%",
    backgroundColor: "#22C55E",
  },
  transportRow: {
    paddingTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  transportBtn: {
    width: 38,
    height: 38,
    borderRadius: 20,
    backgroundColor: "#10182B",
    borderWidth: 1,
    borderColor: "#1C2440",
    alignItems: "center",
    justifyContent: "center",
  },
  transportBtnText: {
    color: "#F5F7FA",
    fontWeight: "900",
    fontSize: 15,
  },
  metaText: {
    color: "#9BA6B9",
    fontSize: 12,
    fontWeight: "700",
  },
  timelinePanel: {
    marginTop: 8,
    backgroundColor: "#091121",
    borderWidth: 1,
    borderColor: "#1A2542",
    borderRadius: 16,
    padding: 10,
    flex: 1,
    minHeight: 150,
  },
  trackLabel: {
    color: "#7F90B1",
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 8,
    letterSpacing: 1,
  },
  timelineViewport: {
    height: 82,
    justifyContent: "center",
  },
  timelineRow: {
    alignItems: "center",
    paddingRight: 12,
    minHeight: 76,
  },
  emptyTimeline: {
    height: 74,
    minWidth: 160,
    borderRadius: 14,
    backgroundColor: "#0A1022",
    borderWidth: 1,
    borderColor: "#1C2440",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  emptyTimelineText: {
    color: "#7F89A0",
    fontSize: 13,
  },
  clipItem: {
    width: THUMB_W,
  },
  thumb: {
    width: THUMB_W,
    height: THUMB_H,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#1C2440",
    backgroundColor: "#0A1022",
  },
  thumbSelected: {
    borderColor: "#FF9500",
    borderWidth: 2,
  },
  thumbCurrent: {
    shadowColor: "#22C55E",
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  thumbImage: {
    width: "100%",
    height: "100%",
  },
  thumbVideo: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#10172B",
  },
  thumbVideoText: {
    color: "#FF9500",
    fontWeight: "900",
    fontSize: 18,
  },
  transitionSeam: {
    width: 14,
    height: 22,
    borderRadius: 10,
    marginHorizontal: -7,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 8,
  },
  transitionSeamIdle: {
    backgroundColor: "#2F374A",
  },
  transitionSeamActive: {
    backgroundColor: "#22C55E",
  },
  transitionSeamText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 9,
  },
  audioTrackBlock: {
    marginTop: 6,
    height: 42,
    borderRadius: 10,
    backgroundColor: "#121B2D",
    borderWidth: 1,
    borderColor: "#1C2440",
    overflow: "hidden",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  audioWaveWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    height: 32,
  },
  audioBar: {
    width: 4,
    borderRadius: 4,
    alignSelf: "center",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.58)",
    justifyContent: "center",
    alignItems: "center",
    padding: 18,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#0A1022",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#1C2440",
    padding: 16,
  },
  modalTitle: {
    color: "#F5F7FA",
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 12,
  },
  modalItem: {
    backgroundColor: "#11182B",
    borderWidth: 1,
    borderColor: "#1C2440",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  modalItemActive: {
    backgroundColor: "#22C55E",
    borderColor: "#22C55E",
  },
  modalItemText: {
    color: "#F1F4F8",
    fontWeight: "800",
  },
  modalItemTextActive: {
    color: "#07120B",
  },
  applyAllBtn: {
    marginTop: 8,
    backgroundColor: "#FF9500",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  applyAllText: {
    color: "#0B0D12",
    fontWeight: "900",
    textAlign: "center",
  },
  closeBtn: {
    marginTop: 10,
    backgroundColor: "#11182B",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  closeText: {
    color: "#F5F7FA",
    textAlign: "center",
    fontWeight: "800",
  },
});

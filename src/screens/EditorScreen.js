import React, { useEffect, useRef, useState } from "react";
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
  useWindowDimensions,
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

const PANEL_MODES = ["media", "clip", "project"];
const SKINS = {
  neon: {
    bg: "#03050A",
    panelBg: "rgba(7,11,20,0.98)",
    panelBorder: "#16203A",
    previewBg: "rgba(8,14,28,0.96)",
    previewBorder: "#2D4A82",
  },
  light: {
    bg: "#EAF1FF",
    panelBg: "rgba(255,255,255,0.95)",
    panelBorder: "#B8C8E6",
    previewBg: "#FFFFFF",
    previewBorder: "#7F9ED8",
  },
  dusk: {
    bg: "#120E1F",
    panelBg: "rgba(30,20,47,0.95)",
    panelBorder: "#4A2C78",
    previewBg: "rgba(25,18,40,0.96)",
    previewBorder: "#8D63D8",
  },
};

function makeId() {
  return "clip_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
}

function ProButton({ title, onPress, primary = false, compact = false, disabled = false }) {
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
    <Pressable
      onPress={disabled ? undefined : onPress}
      onPressIn={disabled ? undefined : pressIn}
      onPressOut={disabled ? undefined : pressOut}
    >
      <Animated.View style={{ transform: [{ scale }], opacity: disabled ? 0.45 : 1 }}>
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
  const bars = new Array(110).fill(0).map((_, i) => {
    const pattern = [10, 16, 24, 12, 28, 18, 34, 14, 26, 12, 30, 20];
    return pattern[i % pattern.length];
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
              backgroundColor: active ? "#22C55E" : "#3A4968",
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
  const [pendingTransition, setPendingTransition] = useState("Dissolve Pro");
  const [transitionsByGap, setTransitionsByGap] = useState({});
  const [formatKey, setFormatKey] = useState("16:9");

  const [audioTrack, setAudioTrack] = useState(null);
  const [isPreparingNext, setIsPreparingNext] = useState(false);
  const [panelMode, setPanelMode] = useState("media");
  const [showVisualPanel, setShowVisualPanel] = useState(true);
  const [clipboardClip, setClipboardClip] = useState(null);
  const [skinKey, setSkinKey] = useState("neon");
  const [audioAccordionOpen, setAudioAccordionOpen] = useState(true);
  const { width } = useWindowDimensions();

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
          if (currentClip.duration) {
            imageTimerRef.current = setTimeout(() => {
              if (!cancelled) advanceToNext();
            }, currentClip.duration);
          }
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

  const duplicateSelected = () => {
    if (!selectedClip) return;
    const duplicate = { ...selectedClip, id: makeId() };
    setClips((prev) => {
      const next = [...prev];
      next.splice(selectedIndex + 1, 0, duplicate);
      return next.slice(0, 15);
    });
    setSelectedIndex((i) => Math.min(i + 1, 14));
    setCurrentIndex((i) => Math.min(i + 1, 14));
  };

  const copySelected = () => {
    if (!selectedClip) return;
    setClipboardClip({ ...selectedClip });
    Alert.alert("Copiado", "Clip copiado al portapapeles.");
  };

  const cutSelected = () => {
    if (!selectedClip) return;
    setClipboardClip({ ...selectedClip });
    removeSelected();
  };

  const pasteClipboard = () => {
    if (!clipboardClip) return;
    const pasted = { ...clipboardClip, id: makeId() };
    const pasteIndex = Math.min(selectedIndex + 1, clips.length);
    setClips((prev) => {
      const next = [...prev];
      next.splice(pasteIndex, 0, pasted);
      return next.slice(0, 15);
    });
    setSelectedIndex(Math.min(pasteIndex, 14));
    setCurrentIndex(Math.min(pasteIndex, 14));
  };

  const rebuildTransitionsAfterMove = (oldClips, newClips) => {
    const oldPairMap = {};
    for (let i = 0; i < oldClips.length - 1; i++) {
      const from = oldClips[i]?.id;
      const to = oldClips[i + 1]?.id;
      if (!from || !to) continue;
      oldPairMap[`${from}->${to}`] = transitionsByGap[i] || "";
    }

    const nextTransitions = {};
    for (let i = 0; i < newClips.length - 1; i++) {
      const key = `${newClips[i]?.id}->${newClips[i + 1]?.id}`;
      if (oldPairMap[key]) {
        nextTransitions[i] = oldPairMap[key];
      }
    }
    return nextTransitions;
  };

  const moveClipByDrag = (fromIndex, delta) => {
    if (!clips.length) return;

    const toIndex = Math.max(0, Math.min(fromIndex + delta, clips.length - 1));
    if (toIndex === fromIndex) return;

    const next = [...clips];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);

    setClips(next);
    setTransitionsByGap(rebuildTransitionsAfterMove(clips, next));
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

  const stretchSelected = (deltaMs) => {
    if (!selectedClip) return;
    const base =
      selectedClip.duration ||
      (selectedClip.type === "image"
        ? IMAGE_DEFAULT_DURATION
        : Math.max(1500, Math.floor((selectedClip.duration || 3000) / 1)));
    const nextDuration = Math.max(300, base + deltaMs);
    setClips((prev) =>
      prev.map((clip, i) => (i === selectedIndex ? { ...clip, duration: nextDuration } : clip))
    );
  };

  const openGapEditor = (gapIndex) => {
    setEditingGapIndex(gapIndex);
    setPendingTransition(transitionsByGap[gapIndex] || "Dissolve Pro");
    setTransitionModalVisible(true);
  };

  const applyTransitionToOne = () => {
    setTransitionsByGap((prev) => ({
      ...prev,
      [editingGapIndex]: pendingTransition,
    }));
    setTransitionModalVisible(false);
  };

  const applyTransitionToAll = () => {
    const next = {};
    for (let i = 0; i < clips.length - 1; i++) {
      next[i] = pendingTransition;
    }
    setTransitionsByGap(next);
    setTransitionModalVisible(false);
  };

  const clearTransitionOnOne = () => {
    setTransitionsByGap((prev) => {
      const copy = { ...prev };
      delete copy[editingGapIndex];
      return copy;
    });
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
  const canEditClip = !!selectedClip;
  const previewHeight = width >= 1200 ? 430 : width >= 900 ? 360 : 250;
  const skin = SKINS[skinKey];

  return (
    <View style={[styles.container, { backgroundColor: skin.bg }]}>
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

      <View style={[styles.previewSection, { height: previewHeight }]}>
        <View
          style={[
            styles.previewInner,
            { aspectRatio: previewAspectRatio, backgroundColor: skin.previewBg, borderColor: skin.previewBorder },
          ]}
        >
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
        <View style={[styles.limitBadge, { borderColor: skin.previewBorder }]}>
          <Text style={styles.limitBadgeText}>LÍMITE REPRODUCTOR</Text>
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

      <View style={[styles.dockArea, { backgroundColor: skin.panelBg, borderColor: skin.panelBorder }]}>
        <View style={styles.skinRow}>
          {Object.keys(SKINS).map((key) => {
            const active = key === skinKey;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.skinChip, active && styles.skinChipActive]}
                onPress={() => setSkinKey(key)}
              >
                <Text style={[styles.skinChipText, active && styles.skinChipTextActive]}>{key}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
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
          <View style={styles.panelTabs}>
            {PANEL_MODES.map((mode) => {
              const active = panelMode === mode;
              const title =
                mode === "media" ? "Media" : mode === "clip" ? "Clip" : "Proyecto";
              return (
                <TouchableOpacity
                  key={mode}
                  onPress={() => setPanelMode(mode)}
                  style={[styles.panelTab, active && styles.panelTabActive]}
                >
                  <Text style={[styles.panelTabText, active && styles.panelTabTextActive]}>
                    {title}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {panelMode === "media" && (
            <View style={styles.toolbarRow}>
              <ProButton title="Importar" onPress={importMedia} primary />
              <ProButton title="Sonido" onPress={importAudio} />
              <ProButton title="Borrar clip" onPress={removeSelected} disabled={!canEditClip} />
              <ProButton title="Duplicar" onPress={duplicateSelected} disabled={!canEditClip} />
            </View>
          )}

          {panelMode === "clip" && (
            <>
              <Text style={styles.panelInfoText}>
                {canEditClip
                  ? `Editando: ${selectedClip.type === "image" ? "Imagen" : "Video"}`
                  : "Selecciona un clip para editar"}
              </Text>
              <View style={styles.toolbarRow}>
                <ProButton title="← Mover" onPress={moveLeft} compact disabled={!canEditClip} />
                <ProButton title="Mover →" onPress={moveRight} compact disabled={!canEditClip} />
                <ProButton title="Cortar" onPress={cutSelected} compact disabled={!canEditClip} />
                <ProButton title="Copiar" onPress={copySelected} compact disabled={!canEditClip} />
                <ProButton
                  title="Pegar"
                  onPress={pasteClipboard}
                  compact
                  disabled={!clipboardClip || clips.length >= 15}
                />
                <ProButton
                  title="Estirar +0.5s"
                  onPress={() => stretchSelected(500)}
                  compact
                  disabled={!canEditClip}
                />
                <ProButton
                  title="Encoger -0.5s"
                  onPress={() => stretchSelected(-500)}
                  compact
                  disabled={!canEditClip}
                />
                <ProButton
                  title="0.3 s"
                  onPress={() => setImageDuration(300)}
                  compact
                  disabled={!canEditClip || selectedClip?.type !== "image"}
                />
                <ProButton
                  title="1 s"
                  onPress={() => setImageDuration(1000)}
                  compact
                  disabled={!canEditClip || selectedClip?.type !== "image"}
                />
                <ProButton
                  title="3 s"
                  onPress={() => setImageDuration(3000)}
                  compact
                  disabled={!canEditClip || selectedClip?.type !== "image"}
                />
                <ProButton
                  title="5 s"
                  onPress={() => setImageDuration(5000)}
                  compact
                  disabled={!canEditClip || selectedClip?.type !== "image"}
                />
              </View>
            </>
          )}

          {panelMode === "project" && (
            <View style={styles.toolbarRow}>
              <ProButton title="Guardar" onPress={handleSaveProject} />
              <ProButton title="Cargar" onPress={handleLoadProject} />
              <ProButton title="Descargar" onPress={downloadProject} />
            </View>
          )}

          <TouchableOpacity
            onPress={() => setShowVisualPanel((v) => !v)}
            style={styles.visualToggle}
          >
            <Text style={styles.visualToggleText}>
              {showVisualPanel ? "Ocultar panel visual" : "Mostrar panel visual"}
            </Text>
          </TouchableOpacity>

          {showVisualPanel && (
            <View style={styles.visualPanel}>
              <Text style={styles.visualTitle}>Panel visual de estado</Text>
              <Text style={styles.visualItem}>Formato: {formatKey}</Text>
              <Text style={styles.visualItem}>Clips: {clips.length}</Text>
              <Text style={styles.visualItem}>Seleccionado: {clips.length ? selectedIndex + 1 : "-"}</Text>
              <Text style={styles.visualItem}>Actual: {clips.length ? currentIndex + 1 : "-"}</Text>
              <Text style={styles.visualItem}>Audio: {audioTrack ? "Cargado" : "Sin audio"}</Text>
              <Text style={styles.visualItem}>Modo panel: {panelMode}</Text>
            </View>
          )}
        </View>

        <View style={[styles.mediaBin, { borderColor: skin.panelBorder }]}>
          <Text style={styles.trackLabel}>BANDEJA MEDIA ({clips.length})</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.mediaBinRow}
          >
            {clips.length === 0 ? (
              <Text style={styles.mediaBinEmpty}>Añade varios clips para verlos aquí</Text>
            ) : (
              clips.map((clip, idx) => (
                <TouchableOpacity
                  key={clip.id}
                  style={[
                    styles.mediaBinItem,
                    idx === selectedIndex && styles.mediaBinItemActive,
                  ]}
                  onPress={() => {
                    setSelectedIndex(idx);
                    setCurrentIndex(idx);
                  }}
                >
                  {clip.type === "image" ? (
                    <Image source={{ uri: clip.uri }} style={styles.mediaBinThumb} />
                  ) : (
                    <View style={styles.mediaBinVideo}>
                      <Text style={styles.mediaBinVideoText}>VIDEO</Text>
                    </View>
                  )}
                  <Text style={styles.mediaBinLabel}>Clip {idx + 1}</Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>

        <View style={styles.audioLaneWrap}>
          <Text style={styles.audioLabel}>
            {audioTrack ? `Audio: ${audioTrack.name}` : "Audio: no cargado"}
          </Text>
          <View style={styles.audioLane}>
            <View style={[styles.audioFill, audioTrack && styles.audioFillLoaded]} />
          </View>
        </View>
        <TouchableOpacity
          style={styles.audioAccordionHead}
          onPress={() => setAudioAccordionOpen((v) => !v)}
        >
          <Text style={styles.audioAccordionHeadText}>
            {audioAccordionOpen ? "Acordeón audio ▼" : "Acordeón audio ►"}
          </Text>
        </TouchableOpacity>
        {audioAccordionOpen && (
          <View style={styles.audioAccordionBody}>
            <ProButton title="Cargar música" onPress={importAudio} compact />
            <View style={styles.audioTrackBlock}>
              <AudioWave active={!!audioTrack} />
            </View>
          </View>
        )}

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

            <Text style={styles.modalHint}>1. Elige una transición</Text>

            <ScrollView style={{ maxHeight: 260 }}>
              {transitions.map((name) => {
                const active = pendingTransition === name;
                return (
                  <TouchableOpacity
                    key={name}
                    style={[styles.modalItem, active && styles.modalItemActive]}
                    onPress={() => setPendingTransition(name)}
                  >
                    <Text style={[styles.modalItemText, active && styles.modalItemTextActive]}>
                      {name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={styles.modalHint}>2. Decide dónde aplicarla</Text>

            <TouchableOpacity style={styles.applyAllBtn} onPress={applyTransitionToOne}>
              <Text style={styles.applyAllText}>Aplicar solo aquí</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.applyAllBtn} onPress={applyTransitionToAll}>
              <Text style={styles.applyAllText}>Aplicar a todas</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.clearBtn} onPress={clearTransitionOnOne}>
              <Text style={styles.clearText}>Quitar transición de esta unión</Text>
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
  skinRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 6,
  },
  skinChip: {
    borderWidth: 1,
    borderColor: "#3A4F7A",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#11182B",
  },
  skinChipActive: {
    backgroundColor: "#FF9500",
    borderColor: "#FF9500",
  },
  skinChipText: {
    color: "#DCE7FB",
    fontWeight: "800",
    fontSize: 11,
  },
  skinChipTextActive: {
    color: "#120E1F",
  },
  limitBadge: {
    marginTop: 6,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  limitBadgeText: {
    color: "#B7C7E6",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
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
  panelTabs: {
    flexDirection: "row",
    gap: 8,
    paddingTop: 8,
  },
  panelTab: {
    backgroundColor: "#0F1627",
    borderColor: "#1C2440",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  panelTabActive: {
    backgroundColor: "#FF9500",
    borderColor: "#FF9500",
  },
  panelTabText: {
    color: "#C9D4E6",
    fontWeight: "800",
    fontSize: 12,
  },
  panelTabTextActive: {
    color: "#111015",
  },
  panelInfoText: {
    color: "#93A0BA",
    fontSize: 12,
    marginTop: 8,
    fontWeight: "700",
  },
  visualToggle: {
    marginTop: 10,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "#10182B",
    borderWidth: 1,
    borderColor: "#1C2440",
  },
  visualToggleText: {
    color: "#C9D4E6",
    fontSize: 12,
    fontWeight: "700",
  },
  visualPanel: {
    marginTop: 8,
    backgroundColor: "#0C1426",
    borderWidth: 1,
    borderColor: "#1C2440",
    borderRadius: 12,
    padding: 10,
    gap: 3,
  },
  visualTitle: {
    color: "#F5F7FA",
    fontWeight: "800",
    marginBottom: 4,
    fontSize: 12,
  },
  visualItem: {
    color: "#97A8C4",
    fontSize: 12,
    fontWeight: "700",
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
  mediaBin: {
    marginTop: 8,
    backgroundColor: "rgba(8,18,36,0.72)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1B2B4A",
    padding: 8,
  },
  mediaBinRow: {
    gap: 8,
    paddingRight: 8,
  },
  mediaBinEmpty: {
    color: "#7F90B1",
    fontSize: 12,
    paddingVertical: 8,
  },
  mediaBinItem: {
    width: 82,
    borderRadius: 10,
    backgroundColor: "#0D1527",
    borderWidth: 1,
    borderColor: "#1C2440",
    overflow: "hidden",
  },
  mediaBinItemActive: {
    borderColor: "#22C55E",
  },
  mediaBinThumb: {
    width: "100%",
    height: 52,
  },
  mediaBinVideo: {
    width: "100%",
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#12213D",
  },
  mediaBinVideoText: {
    color: "#7BE9A9",
    fontWeight: "800",
    fontSize: 10,
  },
  mediaBinLabel: {
    color: "#C9D4E6",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    paddingVertical: 6,
  },
  audioLabel: {
    color: "#9BA6B9",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
  },
  audioLane: {
    height: 12,
    borderRadius: 999,
    backgroundColor: "rgba(13,19,32,0.5)",
    borderWidth: 1,
    borderColor: "rgba(61,97,153,0.5)",
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
    height: 58,
    borderRadius: 14,
    backgroundColor: "rgba(18,27,45,0.45)",
    borderWidth: 1,
    borderColor: "rgba(89,132,209,0.45)",
    overflow: "hidden",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  audioAccordionHead: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2D4372",
    backgroundColor: "rgba(12,24,46,0.55)",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  audioAccordionHeadText: {
    color: "#C8D7F2",
    fontWeight: "800",
    fontSize: 12,
  },
  audioAccordionBody: {
    marginTop: 8,
    gap: 8,
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2B3D66",
    backgroundColor: "rgba(11,19,36,0.45)",
  },
  audioWaveWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    height: 44,
  },
  audioBar: {
    width: 3,
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
    marginBottom: 10,
  },
  modalHint: {
    color: "#92A0B8",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 10,
    marginTop: 4,
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
  clearBtn: {
    marginTop: 8,
    backgroundColor: "#123021",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#1D5E41",
  },
  clearText: {
    color: "#D8FFF0",
    textAlign: "center",
    fontWeight: "800",
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

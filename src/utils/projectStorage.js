import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "mangocut_project_v1";

export async function saveEditorProject(data) {
  await AsyncStorage.setItem(KEY, JSON.stringify(data));
}

export async function loadEditorProject() {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : null;
}

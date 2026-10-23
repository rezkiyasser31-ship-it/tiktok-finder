import AsyncStorage from '@react-native-async-storage/async-storage';
import { HistoryItem } from '../types';

const HISTORY_STORAGE_KEY = '@tiktok_finder_history';
const MAX_HISTORY_ITEMS = 30;

export async function getHistory(): Promise<HistoryItem[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (error) {
    console.warn('Failed to load history:', error);
    return [];
  }
}

export async function saveHistoryItem(item: HistoryItem): Promise<void> {
  try {
    const current = await getHistory();
    // Remove if already exists with same inputUrl
    const filtered = current.filter(
      (h) => h.id !== item.id && (!item.inputUrl || h.inputUrl !== item.inputUrl)
    );
    const updated = [item, ...filtered].slice(0, MAX_HISTORY_ITEMS);
    await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.warn('Failed to save history item:', error);
  }
}

export async function removeHistoryItem(id: string): Promise<void> {
  try {
    const current = await getHistory();
    const updated = current.filter((h) => h.id !== id);
    await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.warn('Failed to remove history item:', error);
  }
}

export async function clearHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(HISTORY_STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear history:', error);
  }
}

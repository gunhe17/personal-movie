import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StateStorage } from 'zustand/middleware';

/** Token 전용 스토리지 (async) */
export const TokenStorage = {
  getAccessToken: async () => AsyncStorage.getItem('access_token'),
  getRefreshToken: async () => AsyncStorage.getItem('refresh_token'),
  setTokens: async (access: string, refresh: string) => {
    await AsyncStorage.multiSet([
      ['access_token', access],
      ['refresh_token', refresh],
    ]);
  },
  clear: async () => {
    await AsyncStorage.multiRemove(['access_token', 'refresh_token']);
  },
};

/** Zustand persist용 AsyncStorage 어댑터 */
export const zustandAsyncStorage: StateStorage = {
  getItem: async (name: string) => AsyncStorage.getItem(name),
  setItem: async (name: string, value: string) => {
    await AsyncStorage.setItem(name, value);
  },
  removeItem: async (name: string) => {
    await AsyncStorage.removeItem(name);
  },
};

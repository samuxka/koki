import { create } from 'zustand';

export type AlertType = 'info' | 'success' | 'warning' | 'danger' | 'confirm';

export interface AlertButtonConfig {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
  isPreferred?: boolean;
}

export interface CustomAlertPayload {
  id: string;
  title: string;
  message?: string;
  type: AlertType;
  buttons: AlertButtonConfig[];
  cancelable?: boolean;
  onDismiss?: () => void;
}

interface AlertState {
  currentAlert: CustomAlertPayload | null;
  queue: CustomAlertPayload[];
  showAlert: (payload: Omit<CustomAlertPayload, 'id'>) => void;
  hideAlert: () => void;
}

export const useAlertStore = create<AlertState>((set, get) => ({
  currentAlert: null,
  queue: [],

  showAlert: (payload) => {
    const newAlert: CustomAlertPayload = {
      ...payload,
      id: Math.random().toString(36).substring(2, 9),
    };

    const { currentAlert, queue } = get();
    if (!currentAlert) {
      set({ currentAlert: newAlert });
    } else {
      set({ queue: [...queue, newAlert] });
    }
  },

  hideAlert: () => {
    const { queue } = get();
    if (queue.length > 0) {
      const [nextAlert, ...remaining] = queue;
      set({ currentAlert: nextAlert, queue: remaining });
    } else {
      set({ currentAlert: null });
    }
  },
}));

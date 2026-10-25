import { Alert as RNAlert } from 'react-native';
import {
  useAlertStore,
  AlertButtonConfig,
  AlertType,
  CustomAlertPayload,
} from '../stores/alert.store';

let isInterceptorInitialized = false;
let originalAlert: typeof RNAlert.alert | null = null;

export function inferAlertType(
  title: string = '',
  message: string = '',
  buttons?: AlertButtonConfig[]
): AlertType {
  const hasDestructive = buttons?.some((b) => b.style === 'destructive');
  if (hasDestructive) return 'danger';

  const combined = `${title} ${message}`.toLowerCase();

  // Error / Danger indicators
  if (
    combined.includes('erro') ||
    combined.includes('falha') ||
    combined.includes('inválid') ||
    combined.includes('recusad') ||
    combined.includes('não foi possível') ||
    combined.includes('bloquead') ||
    combined.includes('excluir') ||
    combined.includes('deletar') ||
    combined.includes('remover')
  ) {
    return 'danger';
  }

  // Success indicators
  if (
    combined.includes('sucesso') ||
    combined.includes('concluíd') ||
    combined.includes('salv') ||
    combined.includes('atualizad') ||
    combined.includes('cadastrad') ||
    combined.includes('quitad') ||
    combined.includes('registrad') ||
    combined.includes('criado')
  ) {
    return 'success';
  }

  // Warning indicators
  if (
    combined.includes('atenção') ||
    combined.includes('aviso') ||
    combined.includes('permissão') ||
    combined.includes('obrigatóri') ||
    combined.includes('cuidado') ||
    combined.includes('limite')
  ) {
    return 'warning';
  }

  // Confirmation indicators if multiple buttons exist
  if (buttons && buttons.length > 1) {
    return 'confirm';
  }

  return 'info';
}

/**
 * Intercepts React Native's default Alert.alert so that all calls across
 * the app use the custom branded confectionery dialog.
 */
export function initAlertInterceptor() {
  if (isInterceptorInitialized) return;
  isInterceptorInitialized = true;
  originalAlert = RNAlert.alert.bind(RNAlert);

  RNAlert.alert = (
    title: string,
    message?: string,
    buttons?: AlertButtonConfig[],
    options?: { cancelable?: boolean; onDismiss?: () => void }
  ) => {
    const type = inferAlertType(title, message, buttons);
    const resolvedButtons: AlertButtonConfig[] =
      buttons && buttons.length > 0
        ? buttons
        : [{ text: 'OK', style: 'default' }];

    useAlertStore.getState().showAlert({
      title,
      message,
      type,
      buttons: resolvedButtons,
      cancelable: options?.cancelable ?? true,
      onDismiss: options?.onDismiss,
    });
  };
}

/**
 * Restore original native alert (useful for test isolation)
 */
export function restoreNativeAlert() {
  if (originalAlert) {
    RNAlert.alert = originalAlert;
    originalAlert = null;
    isInterceptorInitialized = false;
  }
}

/**
 * Direct helper to show a custom alert modal
 */
export function showAlert(payload: Omit<CustomAlertPayload, 'id'>) {
  useAlertStore.getState().showAlert(payload);
}

/**
 * Direct helper for success popup
 */
export function showSuccess(title: string, message?: string, onOk?: () => void) {
  useAlertStore.getState().showAlert({
    title,
    message,
    type: 'success',
    buttons: [{ text: 'OK', onPress: onOk }],
  });
}

/**
 * Direct helper for error popup
 */
export function showError(title: string, message?: string, onOk?: () => void) {
  useAlertStore.getState().showAlert({
    title,
    message,
    type: 'danger',
    buttons: [{ text: 'OK', onPress: onOk }],
  });
}

/**
 * Direct helper for warning popup
 */
export function showWarning(title: string, message?: string, onOk?: () => void) {
  useAlertStore.getState().showAlert({
    title,
    message,
    type: 'warning',
    buttons: [{ text: 'Entendi', onPress: onOk }],
  });
}

/**
 * Direct helper for confirmation dialog
 */
export function showConfirm(
  title: string,
  message: string,
  onConfirm: () => void,
  options?: {
    confirmText?: string;
    cancelText?: string;
    destructive?: boolean;
    onCancel?: () => void;
  }
) {
  useAlertStore.getState().showAlert({
    title,
    message,
    type: options?.destructive ? 'danger' : 'confirm',
    buttons: [
      {
        text: options?.cancelText || 'Cancelar',
        style: 'cancel',
        onPress: options?.onCancel,
      },
      {
        text: options?.confirmText || 'Confirmar',
        style: options?.destructive ? 'destructive' : 'default',
        onPress: onConfirm,
      },
    ],
  });
}

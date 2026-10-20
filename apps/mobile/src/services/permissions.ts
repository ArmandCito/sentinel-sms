import { PermissionsAndroid, Platform } from 'react-native';
import { native } from './native';

export interface PermissionState {
  sms: boolean;
  readSms: boolean;
  notifications: boolean;
  battery: boolean;
}

const P = PermissionsAndroid.PERMISSIONS;
const needsNotifPermission = Platform.OS === 'android' && Number(Platform.Version) >= 33;

export async function checkPermissions(): Promise<PermissionState> {
  if (Platform.OS !== 'android') return { sms: false, readSms: false, notifications: false, battery: false };
  const [sms, readSms, notif] = await Promise.all([
    PermissionsAndroid.check(P.RECEIVE_SMS),
    PermissionsAndroid.check(P.READ_SMS),
    needsNotifPermission ? PermissionsAndroid.check(P.POST_NOTIFICATIONS) : Promise.resolve(true),
  ]);
  return { sms, readSms, notifications: notif, battery: native.isIgnoringBatteryOptimizations() };
}

/** Asks for SMS + notification permissions in one go. */
export async function requestPermissions(): Promise<PermissionState> {
  if (Platform.OS === 'android') {
    const wanted = [P.RECEIVE_SMS, P.READ_SMS, ...(needsNotifPermission ? [P.POST_NOTIFICATIONS] : [])];
    try { await PermissionsAndroid.requestMultiple(wanted); } catch (e) { console.warn('[permissions]', e); }
  }
  return checkPermissions();
}

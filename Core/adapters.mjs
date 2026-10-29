import { ios } from './NativeUtilities/iOS/adapter.mjs';
import { android } from './NativeUtilities/Android/adapter.mjs';
import { web } from './WebUtilities/adapter.mjs';
export const adapters = { iOS: ios, Android: android, Web: web };

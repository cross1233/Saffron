/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

// Saffron-inspired, calm palette
const tintColorLight = '#F4A261'; // saffron
const tintColorDark = '#FFD27F'; // warm saffron/yellow for dark mode accent

export const Colors = {
  light: {
    text: '#2D2A26', // deep warm neutral for readability
    background: '#FFF9E6', // light warm cream
    tint: tintColorLight,
    icon: '#8C7A5B', // muted brown for icons
    tabIconDefault: '#BFA67A', // soft sand
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#F5F2E8', // soft eggshell
    background: '#1C1A16', // very dark warm neutral
    tint: tintColorDark,
    icon: '#C8BFA6', // muted warm light
    tabIconDefault: '#9E8F6F',
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

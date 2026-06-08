import { useThemeContext } from '@/constants/theme';

export function useColorScheme() {
  return useThemeContext().colorScheme;
}

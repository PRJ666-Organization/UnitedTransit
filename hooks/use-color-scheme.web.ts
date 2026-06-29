import { useEffect, useState } from 'react';
import { useThemeContext } from '@/constants/theme';

export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);
  const { colorScheme } = useThemeContext();

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  return hasHydrated ? colorScheme : 'light';
}

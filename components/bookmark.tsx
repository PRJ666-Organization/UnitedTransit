import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type BookmarkLocation = {
  latitude: number;
  longitude: number;
  name?: string;
};

export type BookmarkProps = {
  name: string;
  locations: BookmarkLocation[];
  onPress?: () => void;
  onDelete?: () => void;
};

export default function Bookmark({ name, locations, onPress, onDelete }: BookmarkProps) {
  const theme = useColorScheme() === 'dark'
    ? { cardBg: '#1e2123' }
    : { cardBg: '#ffffff' };

  return (
    <TouchableOpacity onPress={onPress} onLongPress={onDelete} activeOpacity={0.7} delayLongPress={300}>
      <ThemedView style={[styles.card, { backgroundColor: theme.cardBg }]}>
        <View style={styles.header}>
          <ThemedText type="defaultSemiBold" style={styles.name}>
            {name}
          </ThemedText>
          <ThemedText style={styles.count}>
            {locations.length} {locations.length === 1 ? 'stop' : 'stops'}
          </ThemedText>
        </View>

        {locations.map((loc, index) => (
          <View key={index} style={styles.locationRow}>
            <ThemedText style={styles.dot}>●</ThemedText>
            <ThemedText style={styles.locationText} numberOfLines={1}>
              {loc.name ?? `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`}
            </ThemedText>
          </View>
        ))}
      </ThemedView>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  name: {
    fontSize: 18,
  },
  count: {
    fontSize: 14,
    opacity: 0.8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    marginVertical: 2,
  },
  dot: {
    fontSize: 10,
    marginRight: 8,
    opacity: 0.8,
  },
  locationText: {
    fontSize: 14,
    flexShrink: 1,
  },
});

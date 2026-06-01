import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { BookmarkLocation } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type RouteInformationProps = {
  locations: BookmarkLocation[];
  name?: string;
  onClear: () => void;
};

type TransitStep = {
  mode: 'WALKING' | 'TRANSIT';
  instruction: string;
  distance: string;
  duration: string;
  transitLine?: {
    name: string;
    shortName: string;
    color: string;
    icon: string;
  };
  from?: string;
  to?: string;
};

type TransitLeg = {
  steps: TransitStep[];
  duration: string;
  distance: string;
  departureTime?: string;
  arrivalTime?: string;
};

type RouteOption = {
  summary: string;
  legs: TransitLeg[];
};

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export default function RouteInformation({ locations, name, onClear }: RouteInformationProps) {
  const isDark = useColorScheme() === 'dark';
  const colors = isDark
    ? { bg: '#1a1d21', text: '#FFFFFF', sub: '#D0D4D8', border: '#2e3135', accent: '#4a9eff', cardBg: '#24272d', cardBorder: '#35383e' }
    : { bg: '#ffffff', text: '#111', sub: '#444', border: '#e4e5e7', accent: '#0a7ea4', cardBg: '#f5f7fa', cardBorder: '#dde0e4' };

  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDirections = useCallback(async () => {
    if (locations.length < 2) return;
    setLoading(true);
    setError(null);
    try {
      const origin = `${locations[0].latitude},${locations[0].longitude}`;
      const destination = `${locations[locations.length - 1].latitude},${locations[locations.length - 1].longitude}`;

      const url = `${API_URL}/transit-route?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`;

      const res = await fetch(url);
      const json = await res.json();

      if (json.error) {
        setError(json.error);
        setRoutes([]);
      } else {
        const allRoutes = json.routes || [{ summary: '', legs: json.legs || [] }];
        setRoutes(allRoutes);
      }
    } catch (e) {
      setError('Failed to fetch directions');
      console.error('Directions fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [locations]);

  useEffect(() => {
    if (locations.length >= 2) {
      fetchDirections();
    } else {
      setRoutes([]);
      setError(null);
    }
  }, [locations, fetchDirections]);

  if (locations.length === 0) {
    return null;
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} showsVerticalScrollIndicator={false}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <ThemedText type="defaultSemiBold" style={[styles.title, { color: colors.text }]}>
          {name ?? 'Trip Details'}
        </ThemedText>
        <TouchableOpacity onPress={onClear} style={styles.closeButton}>
          <ThemedText style={[styles.closeText, { color: colors.text }]}>✕</ThemedText>
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.loadingContainer}>
          <ThemedText style={[styles.loadingText, { color: colors.sub }]}>Finding transit routes...</ThemedText>
        </View>
      )}

      {error && routes.length === 0 && (
        <View style={styles.errorContainer}>
          <ThemedText style={[styles.errorText, { color: '#e74c3c' }]}>{error}</ThemedText>
        </View>
      )}

      {routes.map((route, routeIndex) => {
        const leg = route.legs[0];
        if (!leg) return null;
        const modes = leg.steps.filter(s => s.mode === 'TRANSIT').map(s => s.transitLine?.icon).join(' ');
        return (
          <View key={routeIndex} style={[styles.routeCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
            <View style={[styles.routeHeader, { borderBottomColor: colors.border }]}>
              <View style={styles.routeTitleRow}>
                <ThemedText style={[styles.routeModes, { color: colors.text }]}>{modes}</ThemedText>
                <ThemedText type="defaultSemiBold" style={[styles.routeSummary, { color: colors.text }]}>
                  {route.summary || `Route ${routeIndex + 1}`}
                </ThemedText>
              </View>
              <View style={styles.routeTimeRow}>
                <ThemedText type="defaultSemiBold" style={[styles.routeDuration, { color: colors.accent }]}>
                  {leg.duration}
                </ThemedText>
                {leg.departureTime && leg.arrivalTime && (
                  <ThemedText style={[styles.routeTimeRange, { color: colors.sub }]}>
                    {leg.departureTime} – {leg.arrivalTime}
                  </ThemedText>
                )}
              </View>
            </View>

            {leg.steps.map((step, stepIndex) => (
              <View key={stepIndex} style={styles.stepRow}>
                <View style={styles.stepLeft}>
                  <View style={styles.iconContainer}>
                    <ThemedText style={styles.stepIcon}>
                      {step.mode === 'WALKING' ? '🚶' : step.transitLine?.icon || '🚌'}
                    </ThemedText>
                  </View>
                  <View style={styles.stepContent}>
                    <View style={styles.stepHeader}>
                      <ThemedText style={[styles.stepTitle, { color: colors.text }]}>
                        {step.instruction}
                      </ThemedText>
                    </View>

                    {step.transitLine && (
                      <View style={styles.transitInfo}>
                        <View style={[styles.lineBadge, { backgroundColor: step.transitLine.color }]}>
                          <ThemedText style={styles.lineName}>{step.transitLine.shortName}</ThemedText>
                        </View>
                        {step.transitLine.name && step.transitLine.name !== step.transitLine.shortName && (
                          <ThemedText style={[styles.agencyName, { color: colors.sub }]}>
                            {step.transitLine.name}
                          </ThemedText>
                        )}
                      </View>
                    )}

                    <View style={styles.stepDetails}>
                      {step.duration && (
                        <ThemedText style={[styles.stepMeta, { color: colors.sub }]}>
                          {step.duration}
                        </ThemedText>
                      )}
                      {step.distance && (
                        <ThemedText style={[styles.stepMeta, { color: colors.sub }]}>
                          {step.distance}
                        </ThemedText>
                      )}
                    </View>
                  </View>
                </View>
                <View style={[styles.stepLine, { borderColor: colors.border }]} />
              </View>
            ))}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 340,
    maxWidth: '60%',
    borderRadius: 0,
    paddingVertical: 16,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
    maxHeight: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
  },
  closeButton: {
    padding: 4,
  },
  closeText: {
    fontSize: 20,
  },
  routeCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  routeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  routeTitleRow: {
    flex: 1,
    marginRight: 8,
  },
  routeModes: {
    fontSize: 15,
    marginBottom: 2,
  },
  routeSummary: {
    fontSize: 13,
  },
  routeTimeRow: {
    alignItems: 'flex-end',
  },
  routeDuration: {
    fontSize: 16,
    fontWeight: '700',
  },
  routeTimeRange: {
    fontSize: 11,
    marginTop: 2,
  },
  loadingContainer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  errorContainer: {
    paddingVertical: 8,
  },
  errorText: {
    fontSize: 13,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  iconContainer: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepIcon: {
    fontSize: 14,
  },
  stepContent: {
    flex: 1,
    marginTop: 2,
  },
  stepHeader: {
    marginBottom: 2,
  },
  stepTitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  transitInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  lineBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  lineName: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  agencyName: {
    fontSize: 10,
    fontStyle: 'italic',
  },
  stepDetails: {
    flexDirection: 'row',
    gap: 8,
  },
  stepMeta: {
    fontSize: 10,
    lineHeight: 13,
  },
  stepLine: {
    position: 'absolute',
    left: 11,
    top: 24,
    bottom: -6,
    width: 1,
    borderStyle: 'dashed',
  },
});

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { BookmarkLocation } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type RouteInformationProps = {
  locations: BookmarkLocation[];
  name?: string;
  onClear: () => void;
  onRoutesLoaded?: (polylines: { steps: { mode: 'WALKING' | 'TRANSIT'; polyline?: string; color?: string }[] }[]) => void;
  onRouteSelected?: (routeIndex: number) => void;
  selectedRouteIndex?: number;
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
  numStops?: number;
  polyline?: string;
  departureTime?: string;
  arrivalTime?: string;
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

type TransitFilter = 'all' | 'subway' | 'bus';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

// Parse "2:30 pm" / "12:05 am" into total minutes since midnight
function parseTimeToMinutes(timeStr: string): number | null {
  const match = timeStr.match(/(\d+):(\d+)\s*(am|pm)/i);
  if (!match) return null;
  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const period = match[3].toLowerCase();
  if (period === 'pm' && hours !== 12) hours += 12;
  if (period === 'am' && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

function formatMinutesToTime(totalMinutes: number): string {
  const wrapped = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  const period = h >= 12 ? 'pm' : 'am';
  const displayH = h % 12 || 12;
  return `${displayH}:${m.toString().padStart(2, '0')} ${period}`;
}

function formatStopDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

// Map transit types to categories - including all possible vehicle types from Google
const SUBWAY_VEHICLE_TYPES = ['SUBWAY_TRAIN', 'METRO_RAIL', 'HEAVY_RAIL', 'COMMUTER_TRAIN', 'HIGH_SPEED_TRAIN', 'RAIL'];
const BUS_VEHICLE_TYPES = ['BUS', 'TROLLEYBUS', 'TROLLEY_BUS'];

// Check if a route contains a specific transit type based on vehicle type
function routeHasVehicleType(leg: TransitLeg, vehicleTypes: string[]): boolean {
  const transitSteps = leg.steps.filter(s => s.mode === 'TRANSIT');
  // The icon in the data should match, but we also check vehicle type if available
  return transitSteps.some(s => {
    const icon = s.transitLine?.icon || '🚌';
    // Check by icon
    if (icon === '🚇' || icon === '🚆') return vehicleTypes === SUBWAY_VEHICLE_TYPES || vehicleTypes.some(t => SUBWAY_VEHICLE_TYPES.includes(t));
    if (icon === '🚌' || icon === '⛴️') return vehicleTypes === BUS_VEHICLE_TYPES || vehicleTypes.some(t => BUS_VEHICLE_TYPES.includes(t));
    return false;
  });
}

function routeContainsSubway(leg: TransitLeg): boolean {
  const transitSteps = leg.steps.filter(s => s.mode === 'TRANSIT');
  // Check by icon (🚇 = subway, 🚆 = train/rail, 🚋 = tram)
  return transitSteps.some(s => {
    const icon = s.transitLine?.icon || '';
    return icon === '🚇' || icon === '🚆';
  });
}

function routeContainsBus(leg: TransitLeg): boolean {
  const transitSteps = leg.steps.filter(s => s.mode === 'TRANSIT');
  return transitSteps.some(s => {
    const icon = s.transitLine?.icon || '';
    return icon === '🚌' || icon === '⛴️';
  });
}

export default function RouteInformation({ locations, name, onClear, onRoutesLoaded, onRouteSelected, selectedRouteIndex }: RouteInformationProps) {
  const isDark = useColorScheme() === 'dark';
  const colors = isDark
    ? { bg: '#151718', text: '#FFFFFF', sub: '#A0A4A8', border: '#3d4148', accent: '#4a9eff', cardBg: '#2a2d33', cardBorder: '#404450' }
    : { bg: '#ffffff', text: '#111', sub: '#555555', border: '#d0d0d0', accent: '#0a7ea4', cardBg: '#f8f9fa', cardBorder: '#dde0e4' };

  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transitFilter, setTransitFilter] = useState<TransitFilter>('all');

  // Per-stop durations: index 0 = first stop after origin, last index = final destination
  const [stopDurations, setStopDurations] = useState<number[]>([]);
  const [activeCustomIdx, setActiveCustomIdx] = useState<number | null>(null);
  const [customStopInput, setCustomStopInput] = useState('');

  // Sync array length when locations change
  React.useEffect(() => {
    const stopCount = Math.max(0, locations.length - 1);
    setStopDurations(prev => {
      if (prev.length === stopCount) return prev;
      const next = Array(stopCount).fill(0);
      prev.forEach((v, i) => { if (i < stopCount) next[i] = v; });
      return next;
    });
    setActiveCustomIdx(null);
    setCustomStopInput('');
  }, [locations.length]);

  const updateStopDuration = useCallback((idx: number, mins: number) => {
    setStopDurations(prev => {
      const next = [...prev];
      next[idx] = mins;
      return next;
    });
  }, []);

  const totalStopMins = stopDurations.reduce((a, b) => a + b, 0);

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
      onRoutesLoaded?.([]);
    }
  }, [locations, fetchDirections]);

  // Notify parent when routes are loaded
  useEffect(() => {
    if (routes.length > 0 && onRoutesLoaded) {
      const polylines = routes.map(route => ({
        steps: route.legs[0]?.steps.map(step => ({
          mode: step.mode,
          polyline: step.polyline,
          color: step.transitLine?.color,
        })) || [],
      }));
      onRoutesLoaded(polylines);
    }
  }, [routes, onRoutesLoaded]);

  // Filter routes based on selected transit type
  const filteredRoutes = useMemo(() => {
    if (transitFilter === 'all') return routes;

    return routes.filter(route => {
      const leg = route.legs[0];
      if (!leg) return false;

      if (transitFilter === 'subway') {
        return routeContainsSubway(leg);
      } else if (transitFilter === 'bus') {
        return routeContainsBus(leg);
      }
      return true;
    });
  }, [routes, transitFilter]);

  // Count routes by type
  const routeCounts = useMemo(() => {
    let subway = 0;
    let bus = 0;

    routes.forEach(route => {
      const leg = route.legs[0];
      if (!leg) return;

      if (routeContainsSubway(leg)) subway++;
      if (routeContainsBus(leg)) bus++;
    });

    return { subway, bus };
  }, [routes]);

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

      {/* Transit Type Filter */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterBtn, {
            backgroundColor: transitFilter === 'all' ? colors.accent : isDark ? '#3a3d42' : '#e8e8e8',
          }]}
          onPress={() => setTransitFilter('all')}
        >
          <ThemedText style={[styles.filterText, { color: transitFilter === 'all' ? '#fff' : colors.text }]}>
            All
          </ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterBtn, {
            backgroundColor: transitFilter === 'subway' ? colors.accent : isDark ? '#3a3d42' : '#e8e8e8',
          }]}
          onPress={() => setTransitFilter('subway')}
        >
          <ThemedText style={[styles.filterText, { color: transitFilter === 'subway' ? '#fff' : colors.text }]}>
            🚇 Metro
          </ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterBtn, {
            backgroundColor: transitFilter === 'bus' ? colors.accent : isDark ? '#3a3d42' : '#e8e8e8',
          }]}
          onPress={() => setTransitFilter('bus')}
        >
          <ThemedText style={[styles.filterText, { color: transitFilter === 'bus' ? '#fff' : colors.text }]}>
            🚌 Bus
          </ThemedText>
        </TouchableOpacity>
      </View>

      {/* Per-stop duration selectors */}
      {routes.length > 0 && locations.length > 1 && (
        <View style={[styles.stopSection, { borderColor: colors.border }]}>
          <ThemedText style={[styles.stopSectionLabel, { color: colors.sub }]}>
            Stop Durations
          </ThemedText>
          {locations.slice(1).map((loc, i) => {
            const currentMins = stopDurations[i] ?? 0;
            const isCustomActive = activeCustomIdx === i;
            const stopLabel = loc.name ? loc.name.split(',')[0] : `Stop ${i + 1}`;
            return (
              <View key={i} style={[styles.stopRow, { borderBottomColor: colors.border }]}>
                <ThemedText style={[styles.stopRowLabel, { color: colors.text }]} numberOfLines={1}>
                  {stopLabel}
                </ThemedText>
                <View style={styles.stopButtons}>
                  {[0, 15, 30, 60, 120].map(mins => {
                    const isActive = currentMins === mins && !isCustomActive;
                    const label = mins === 0 ? 'None' : mins < 60 ? `${mins}m` : `${mins / 60}h`;
                    return (
                      <TouchableOpacity
                        key={mins}
                        style={[styles.stopBtn, { borderColor: isActive ? colors.accent : colors.border }, isActive && { backgroundColor: colors.accent }]}
                        onPress={() => { updateStopDuration(i, mins); setActiveCustomIdx(null); }}
                      >
                        <ThemedText style={[styles.stopBtnText, { color: isActive ? '#fff' : colors.text }]}>
                          {label}
                        </ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                  <TouchableOpacity
                    style={[styles.stopBtn, { borderColor: isCustomActive ? colors.accent : colors.border }, isCustomActive && { backgroundColor: colors.accent }]}
                    onPress={() => { setActiveCustomIdx(i); setCustomStopInput(currentMins > 0 ? String(currentMins) : ''); }}
                  >
                    <ThemedText style={[styles.stopBtnText, { color: isCustomActive ? '#fff' : colors.text }]}>
                      Custom
                    </ThemedText>
                  </TouchableOpacity>
                </View>
                {isCustomActive && (
                  <TextInput
                    style={[styles.stopCustomInput, { color: colors.text, borderColor: colors.border }]}
                    placeholder="Enter minutes"
                    placeholderTextColor={colors.sub}
                    keyboardType="numeric"
                    value={customStopInput}
                    onChangeText={text => {
                      setCustomStopInput(text);
                      const parsed = parseInt(text);
                      if (!isNaN(parsed) && parsed >= 0) updateStopDuration(i, parsed);
                    }}
                    autoFocus
                  />
                )}
              </View>
            );
          })}
        </View>
      )}

      {loading && (
        <View style={styles.loadingContainer}>
          <ThemedText style={[styles.loadingText, { color: colors.sub }]}>Finding transit routes...</ThemedText>
        </View>
      )}

      {error && filteredRoutes.length === 0 && (
        <View style={styles.errorContainer}>
          <ThemedText style={[styles.errorText, { color: '#e74c3c' }]}>{error}</ThemedText>
        </View>
      )}

      {!loading && filteredRoutes.length === 0 && routes.length > 0 && (
        <View style={styles.errorContainer}>
          <ThemedText style={[styles.errorText, { color: colors.sub }]}>
            No {transitFilter === 'subway' ? 'metro/subway' : transitFilter === 'bus' ? 'bus' : ''} routes found for this trip.
          </ThemedText>
        </View>
      )}

      {filteredRoutes.map((route, routeIndex) => {
        const leg = route.legs[0];
        if (!leg) return null;
        const transitSteps = leg.steps.filter(s => s.mode === 'TRANSIT');
        const modes = transitSteps.map(s => s.transitLine?.icon).join(' ');

        // Build a summary of transit lines with their names
        const lineSummary = transitSteps.map(s => {
          const name = s.transitLine?.shortName || s.instruction;
          return name;
        }).join(' → ');

        const isSelected = selectedRouteIndex === routeIndex;

        return (
          <TouchableOpacity
            key={routeIndex}
            style={[
              styles.routeCard,
              {
                backgroundColor: isSelected ? (isDark ? '#3d4148' : '#e8f4fc') : colors.cardBg,
                borderColor: isSelected ? colors.accent : colors.cardBorder,
                borderWidth: isSelected ? 2 : 1,
              },
            ]}
            onPress={() => onRouteSelected?.(routeIndex)}
            activeOpacity={0.7}
          >
            <View style={[styles.routeHeader, { borderBottomColor: colors.border }]}>
              <View style={styles.routeTitleRow}>
                <ThemedText style={[styles.routeModes, { color: colors.text }]}>{modes}</ThemedText>
                <ThemedText type="defaultSemiBold" style={[styles.routeSummary, { color: colors.text }]}>
                  {route.summary || `Route ${routeIndex + 1}`}
                </ThemedText>
              </View>
              <View style={styles.routeTimeRow}>
                <ThemedText type="defaultSemiBold" style={[styles.routeDuration, { color: colors.accent }]}>
                  {leg.duration}{totalStopMins > 0 ? ` + ${formatStopDuration(totalStopMins)} stops` : ''}
                </ThemedText>
                {leg.departureTime && leg.arrivalTime && (
                  <ThemedText style={[styles.routeTimeRange, { color: colors.sub }]}>
                    {leg.departureTime} – {leg.arrivalTime}
                  </ThemedText>
                )}
              </View>
            </View>

            {/* Transit Line Summary */}
            {lineSummary && (
              <View style={styles.lineSummaryContainer}>
                <ThemedText style={[styles.lineSummaryText, { color: colors.text }]}>
                  {lineSummary}
                </ThemedText>
              </View>
            )}

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
                        {step.numStops !== undefined && (
                          <ThemedText style={[styles.stopsText, { color: colors.sub }]}>
                            {step.numStops} stop{step.numStops !== 1 ? 's' : ''}
                          </ThemedText>
                        )}
                      </View>
                    )}

                    {/* Show departure time for transit steps */}
                    {step.mode === 'TRANSIT' && step.departureTime && (
                      <View style={styles.departureInfo}>
                        <ThemedText style={[styles.departureText, { color: colors.accent, fontWeight: '600' }]}>
                          Depart: {step.departureTime}
                        </ThemedText>
                        {step.arrivalTime && (
                          <ThemedText style={[styles.departureText, { color: colors.sub }]}>
                            Arrive: {step.arrivalTime}
                          </ThemedText>
                        )}
                      </View>
                    )}

                    {step.from && step.to && (
                      <View style={styles.stopInfo}>
                        <ThemedText style={[styles.stopText, { color: colors.sub }]}>
                          From: {step.from}
                        </ThemedText>
                        <ThemedText style={[styles.stopText, { color: colors.sub }]}>
                          To: {step.to}
                        </ThemedText>
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

            {stopDurations.map((mins, i) => {
              if (mins <= 0) return null;
              const stopLoc = locations[i + 1];
              const isLast = i === stopDurations.length - 1;
              const resumeTime = isLast && leg.arrivalTime && parseTimeToMinutes(leg.arrivalTime) !== null
                ? formatMinutesToTime(parseTimeToMinutes(leg.arrivalTime)! + mins)
                : null;
              return (
                <View key={i} style={[styles.stopDurationRow, { backgroundColor: isDark ? '#3a2a10' : '#fff8e1', borderColor: '#e67e22' }]}>
                  <View style={styles.stopDurationHeader}>
                    <ThemedText style={[styles.stopDurationIcon, { color: '#e67e22' }]}>⏱</ThemedText>
                    <ThemedText style={[styles.stopDurationLabel, { color: '#e67e22' }]}>
                      {`Stop ${i + 1}${stopLoc?.name ? `: ${stopLoc.name.split(',')[0]}` : ''} — ${formatStopDuration(mins)}`}
                    </ThemedText>
                  </View>
                  {resumeTime && (
                    <ThemedText style={[styles.stopResumeText, { color: colors.sub }]}>
                      {`Resume transit at ${resumeTime}`}
                    </ThemedText>
                  )}
                </View>
              );
            })}
          </TouchableOpacity>
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
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
  },
  closeButton: {
    padding: 6,
  },
  closeText: {
    fontSize: 22,
  },
  filterContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  filterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#e0e0e0',
  },
  filterText: {
    fontSize: 15,
    fontWeight: '500',
  },
  routeCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  routeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  routeTitleRow: {
    flex: 1,
    marginRight: 10,
  },
  routeModes: {
    fontSize: 20,
    marginBottom: 4,
  },
  routeSummary: {
    fontSize: 15,
    fontWeight: '500',
  },
  routeTimeRow: {
    alignItems: 'flex-end',
  },
  routeDuration: {
    fontSize: 20,
    fontWeight: '700',
  },
  routeTimeRange: {
    fontSize: 13,
    marginTop: 3,
  },
  lineSummaryContainer: {
    marginTop: 10,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  lineSummaryText: {
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontStyle: 'italic',
  },
  errorContainer: {
    paddingVertical: 10,
  },
  errorText: {
    fontSize: 15,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 6,
  },
  stepLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  iconContainer: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepIcon: {
    fontSize: 18,
  },
  stepContent: {
    flex: 1,
    marginTop: 2,
  },
  stepHeader: {
    marginBottom: 4,
  },
  stepTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
  },
  transitInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
    marginTop: 4,
  },
  lineBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  lineName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  stopsText: {
    fontSize: 14,
    fontWeight: '500',
  },
  stopInfo: {
    marginBottom: 4,
    marginTop: 2,
  },
  stopText: {
    fontSize: 13,
    lineHeight: 18,
  },
  departureInfo: {
    marginTop: 6,
    marginBottom: 4,
  },
  departureText: {
    fontSize: 14,
    lineHeight: 18,
  },
  agencyName: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  stepDetails: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  stepMeta: {
    fontSize: 13,
    lineHeight: 16,
  },
  stepLine: {
    position: 'absolute',
    left: 14,
    top: 30,
    bottom: -8,
    width: 1,
    borderStyle: 'dashed',
  },
  stopSection: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: 10,
    marginBottom: 12,
  },
  stopSectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  stopRow: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stopRowLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  stopButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  stopBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  stopBtnText: {
    fontSize: 13,
    fontWeight: '500',
  },
  stopCustomInput: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
  },
  stopDurationRow: {
    marginTop: 10,
    marginBottom: 4,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  stopDurationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stopDurationIcon: {
    fontSize: 16,
  },
  stopDurationLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  stopResumeText: {
    fontSize: 13,
    marginTop: 4,
    marginLeft: 22,
  },
});

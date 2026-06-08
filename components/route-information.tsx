import { ThemedText } from '@/components/themed-text';
import { BookmarkLocation } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export type RouteInformationProps = {
  locations: BookmarkLocation[];
  name?: string;
  onClear: () => void;
  onRoutesLoaded?: (
    polylines: { steps: { mode: 'WALKING' | 'TRANSIT'; polyline?: string; color?: string }[] }[],
  ) => void;
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

function routeContainsSubway(leg: TransitLeg): boolean {
  return leg.steps
    .filter((s) => s.mode === 'TRANSIT')
    .some((s) => {
      const icon = s.transitLine?.icon || '';
      return icon === '🚇' || icon === '🚆';
    });
}

function routeContainsBus(leg: TransitLeg): boolean {
  return leg.steps
    .filter((s) => s.mode === 'TRANSIT')
    .some((s) => {
      const icon = s.transitLine?.icon || '';
      return icon === '🚌' || icon === '⛴️';
    });
}

// Wheel picker constants
const WHEEL_ITEM_H = 44;
const WHEEL_VISIBLE = 3;
const WHEEL_H = WHEEL_ITEM_H * WHEEL_VISIBLE;
const WHEEL_PAD = WHEEL_ITEM_H; // (WHEEL_H - WHEEL_ITEM_H) / 2

const HOUR_ITEMS = Array.from({ length: 13 }, (_, i) => i); // 0–12 h
const MINUTE_ITEMS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

type WheelColors = { text: string; sub: string; accent: string; border: string };

type WheelColumnProps = {
  items: number[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  format: (val: number) => string;
  colors: WheelColors;
};

function WheelColumn({ items, selectedIndex, onSelect, format, colors }: WheelColumnProps) {
  const ref = useRef<ScrollView>(null);
  const [liveIdx, setLiveIdx] = useState(selectedIndex);
  const onSelectRef = useRef(onSelect);
  const pendingIdxRef = useRef(selectedIndex); // tracks last known position

  useEffect(() => {
    onSelectRef.current = onSelect;
  });

  useEffect(() => {
    const t = setTimeout(() => {
      ref.current?.scrollTo({ y: selectedIndex * WHEEL_ITEM_H, animated: false });
    }, 60);
    return () => clearTimeout(t);
  }, []);

  const settle = useCallback(
    (rawY: number) => {
      const idx = Math.max(0, Math.min(items.length - 1, Math.round(rawY / WHEEL_ITEM_H)));
      ref.current?.scrollTo({ y: idx * WHEEL_ITEM_H, animated: false });
      setLiveIdx(idx);
      pendingIdxRef.current = idx;
      onSelectRef.current(idx);
    },
    [items.length],
  );

  const onScrollMove = useCallback(
    (e: any) => {
      const rawY = e.nativeEvent.contentOffset.y;
      const idx = Math.max(0, Math.min(items.length - 1, Math.round(rawY / WHEEL_ITEM_H)));
      setLiveIdx(idx);
      pendingIdxRef.current = idx;
      // Web: commit on every scroll event since momentum/dragEnd don't fire
      onSelectRef.current(idx);
    },
    [items.length],
  );

  // Snap + commit when scrolling stops.
  // holds the latest callback, so the stable closure is never stale.
  const onScrollSettle = useCallback(
    (rawY: number) => {
      const idx = Math.max(0, Math.min(items.length - 1, Math.round(rawY / WHEEL_ITEM_H)));
      ref.current?.scrollTo({ y: idx * WHEEL_ITEM_H, animated: false });
      setLiveIdx(idx);
      console.log('onScrollSettle firing, idx:', idx);
      console.log('onSelectRef.current:', onSelectRef.current.toString());
      onSelectRef.current(idx);
    },
    [items.length],
  );

  return (
    <View style={{ height: WHEEL_H, overflow: 'hidden', flex: 1 }}>
      <View
        style={{
          position: 'absolute',
          top: WHEEL_PAD,
          height: WHEEL_ITEM_H,
          left: 8,
          right: 8,
          borderTopWidth: 1.5,
          borderBottomWidth: 1.5,
          borderColor: colors.accent,
        }}
        pointerEvents="none"
      />
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={WHEEL_ITEM_H}
        decelerationRate="fast"
        nestedScrollEnabled={true}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingVertical: WHEEL_PAD }}
        onScroll={onScrollMove}
        onMomentumScrollEnd={(e) => settle(e.nativeEvent.contentOffset.y)}
        onScrollEndDrag={(e) => settle(e.nativeEvent.contentOffset.y)}
      >
        {items.map((val, i) => {
          const isCenter = i === liveIdx;
          return (
            <View
              key={i}
              style={{ height: WHEEL_ITEM_H, alignItems: 'center', justifyContent: 'center' }}
            >
              <ThemedText
                style={{
                  fontSize: isCenter ? 20 : 14,
                  fontWeight: isCenter ? '700' : '400',
                  color: isCenter ? colors.accent : colors.sub,
                  opacity: isCenter ? 1 : 0.45,
                }}
              >
                {format(val)}
              </ThemedText>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default function RouteInformation({
  locations,
  name,
  onClear,
  onRoutesLoaded,
  onRouteSelected,
  selectedRouteIndex,
}: RouteInformationProps) {
  const isDark = useColorScheme() === 'dark';
  const colors = isDark
    ? {
        bg: '#151718',
        text: '#FFFFFF',
        sub: '#A0A4A8',
        border: '#3d4148',
        accent: '#4a9eff',
        cardBg: '#2a2d33',
        cardBorder: '#404450',
      }
    : {
        bg: '#ffffff',
        text: '#111',
        sub: '#555555',
        border: '#d0d0d0',
        accent: '#0a7ea4',
        cardBg: '#f8f9fa',
        cardBorder: '#dde0e4',
      };

  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transitFilter, setTransitFilter] = useState<TransitFilter>('all');

  const [stopDurations, setStopDurations] = useState<number[]>([]);
  // Modal picker state — single source of truth in minutes
  const [pickerStopIdx, setPickerStopIdx] = useState<number | null>(null);
  const [draftMinutes, setDraftMinutes] = useState(0);

  // FIX 2: Mirror draftMinutes into a ref so applyPicker never closes
  // over a stale value — it always reads whatever was last committed.
  const draftMinutesRef = useRef(draftMinutes);
  useEffect(() => {
    draftMinutesRef.current = draftMinutes;
  }, [draftMinutes]);

  React.useEffect(() => {
    const stopCount = Math.max(0, locations.length - 1);
    setStopDurations((prev) => {
      if (prev.length === stopCount) return prev;
      const next = Array(stopCount).fill(0);
      prev.forEach((v, i) => {
        if (i < stopCount) next[i] = v;
      });
      return next;
    });
    setPickerStopIdx(null);
  }, [locations.length]);

  const openPicker = useCallback(
    (i: number) => {
      // Snap stored minutes to nearest 5 so wheel aligns cleanly
      const raw = stopDurations[i] ?? 0;
      const snapped = Math.round(raw / 5) * 5;
      setDraftMinutes(snapped);
      setPickerStopIdx(i);
    },
    [stopDurations],
  );

  const updateStopDuration = useCallback((idx: number, mins: number) => {
    setStopDurations((prev) => {
      const next = [...prev];
      next[idx] = mins;
      return next;
    });
  }, []);

  // FIX 2 (cont): Read from draftMinutesRef so this is never stale
  // regardless of when React schedules the re-render after wheel settle.
  const applyPicker = () => {
    console.log(
      'applyPicker — pickerStopIdx:',
      pickerStopIdx,
      'draftMinutesRef.current:',
      draftMinutesRef.current,
    );
    if (pickerStopIdx !== null) {
      updateStopDuration(pickerStopIdx, draftMinutesRef.current);
    }
    setPickerStopIdx(null);
  };

  const totalStopMins = stopDurations.reduce((a, b) => a + b, 0);

  const fetchDirections = useCallback(async () => {
    if (locations.length < 2) return;
    setLoading(true);
    setError(null);
    try {
      if (locations.length === 2) {
        const origin = `${locations[0].latitude},${locations[0].longitude}`;
        const destination = `${locations[1].latitude},${locations[1].longitude}`;
        const url = `${API_URL}/transit-route?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`;
        const res = await fetch(url);
        const json = await res.json();
        if (json.error) {
          setError(json.error);
          setRoutes([]);
        } else {
          setRoutes(json.routes || [{ summary: '', legs: json.legs || [] }]);
        }
      } else {
        // Multi-stop: fetch each consecutive leg pair separately, then combine
        const legFetches: Promise<any>[] = [];
        for (let i = 0; i < locations.length - 1; i++) {
          const o = `${locations[i].latitude},${locations[i].longitude}`;
          const d = `${locations[i + 1].latitude},${locations[i + 1].longitude}`;
          const url = `${API_URL}/transit-route?origin=${encodeURIComponent(o)}&destination=${encodeURIComponent(d)}`;
          legFetches.push(
            fetch(url)
              .then((r) => r.json())
              .catch(() => null),
          );
        }
        const legResults = await Promise.all(legFetches);
        const combinedLegs: TransitLeg[] = legResults.flatMap((json) => {
          if (!json || json.error || !json.routes?.length) return [];
          return json.routes[0].legs as TransitLeg[];
        });
        if (combinedLegs.length === 0) {
          setError('No transit routes found for this trip');
          setRoutes([]);
        } else {
          setRoutes([{ summary: 'Multi-stop route', legs: combinedLegs }]);
        }
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

  // Notify parent with polylines from ALL legs (fixes 3+ stop map lines)
  useEffect(() => {
    if (routes.length > 0 && onRoutesLoaded) {
      const polylines = routes.map((route) => ({
        steps: route.legs.flatMap((leg) =>
          leg.steps.map((step) => ({
            mode: step.mode,
            polyline: step.polyline,
            color: step.transitLine?.color,
          })),
        ),
      }));
      onRoutesLoaded(polylines);
    }
  }, [routes, onRoutesLoaded]);

  const filteredRoutes = useMemo(() => {
    if (transitFilter === 'all') return routes;
    return routes.filter((route) => {
      const combinedLeg: TransitLeg = {
        steps: route.legs.flatMap((l) => l.steps),
        duration: '',
        distance: '',
      };
      if (transitFilter === 'subway') return routeContainsSubway(combinedLeg);
      if (transitFilter === 'bus') return routeContainsBus(combinedLeg);
      return true;
    });
  }, [routes, transitFilter]);

  const routeCounts = useMemo(() => {
    let subway = 0,
      bus = 0;
    routes.forEach((route) => {
      const combinedLeg: TransitLeg = {
        steps: route.legs.flatMap((l) => l.steps),
        duration: '',
        distance: '',
      };
      if (routeContainsSubway(combinedLeg)) subway++;
      if (routeContainsBus(combinedLeg)) bus++;
    });
    return { subway, bus };
  }, [routes]);

  if (locations.length === 0) return null;

  const pickerStopName =
    pickerStopIdx !== null
      ? (locations[pickerStopIdx + 1]?.name?.split(',')[0] ?? `Stop ${pickerStopIdx + 1}`)
      : '';

  const draftH = Math.min(HOUR_ITEMS.length - 1, Math.floor(draftMinutes / 60));
  const draftM = Math.max(0, MINUTE_ITEMS.indexOf(draftMinutes % 60));

  return (
    <>
      {/* Duration picker modal — rendered outside the panel ScrollView so wheels work freely */}
      <Modal
        visible={pickerStopIdx !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerStopIdx(null)}
      >
        <TouchableOpacity
          style={modalStyles.backdrop}
          activeOpacity={1}
          onPress={() => setPickerStopIdx(null)}
        />
        <View style={[modalStyles.sheet, { backgroundColor: isDark ? '#1e2126' : '#ffffff' }]}>
          {/* Header */}
          <View style={[modalStyles.sheetHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setPickerStopIdx(null)} style={modalStyles.sheetBtn}>
              <Text style={[modalStyles.sheetCancel, { color: colors.sub }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[modalStyles.sheetTitle, { color: colors.text }]} numberOfLines={1}>
              {pickerStopName}
            </Text>
            <TouchableOpacity onPress={applyPicker} style={modalStyles.sheetBtn}>
              <Text style={[modalStyles.sheetDone, { color: colors.accent }]}>Done</Text>
            </TouchableOpacity>
          </View>

          {/* Wheels */}
          <View style={modalStyles.wheelsRow}>
            <WheelColumn
              items={HOUR_ITEMS}
              selectedIndex={draftH}
              onSelect={(idx) => setDraftMinutes(idx * 60 + MINUTE_ITEMS[draftM])}
              format={(v) => `${v} hr`}
              colors={colors}
            />
            <Text style={[modalStyles.wheelColon, { color: colors.sub }]}>:</Text>
            <WheelColumn
              items={MINUTE_ITEMS}
              selectedIndex={draftM}
              onSelect={(idx) => setDraftMinutes(draftH * 60 + MINUTE_ITEMS[idx])}
              format={(v) => `${String(v).padStart(2, '0')} min`}
              colors={colors}
            />
          </View>

          {/* Live preview */}
          <View style={modalStyles.previewRow}>
            {draftMinutes > 0 ? (
              <Text style={[modalStyles.previewText, { color: colors.accent }]}>
                {formatStopDuration(draftMinutes)} stop
              </Text>
            ) : (
              <Text style={[modalStyles.previewText, { color: colors.sub }]}>No stop time</Text>
            )}
          </View>
        </View>
      </Modal>

      <ScrollView
        style={[styles.container, { backgroundColor: colors.bg }]}
        showsVerticalScrollIndicator={false}
      >
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
          {(['all', 'subway', 'bus'] as TransitFilter[]).map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterBtn,
                {
                  backgroundColor:
                    transitFilter === filter ? colors.accent : isDark ? '#3a3d42' : '#e8e8e8',
                },
              ]}
              onPress={() => setTransitFilter(filter)}
            >
              <ThemedText
                style={[
                  styles.filterText,
                  { color: transitFilter === filter ? '#fff' : colors.text },
                ]}
              >
                {filter === 'all' ? 'All' : filter === 'subway' ? '🚇 Metro' : '🚌 Bus'}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>

        {/* Per-stop duration rows — tap to open wheel picker modal */}
        {locations.length > 1 && (
          <View style={[styles.stopSection, { borderColor: colors.border }]}>
            <ThemedText style={[styles.stopSectionLabel, { color: colors.sub }]}>
              Stop Durations
            </ThemedText>
            {locations.slice(1).map((loc, i) => {
              const totalMins = stopDurations[i] ?? 0;
              const stopLabel = loc.name ? loc.name.split(',')[0] : `Stop ${i + 1}`;
              const isLastStop = i === locations.length - 2;
              return (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.stopRow,
                    styles.stopRowHeader,
                    { borderBottomColor: colors.border },
                  ]}
                  onPress={() => openPicker(i)}
                  activeOpacity={0.7}
                >
                  <ThemedText
                    style={[styles.stopRowLabel, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {isLastStop ? '🏁' : '📍'} {stopLabel}
                  </ThemedText>
                  <View style={styles.stopRowRight}>
                    <ThemedText
                      style={[
                        styles.stopDurationBadge,
                        {
                          color: totalMins > 0 ? colors.accent : colors.sub,
                          backgroundColor:
                            totalMins > 0 ? (isDark ? '#1a3a5c' : '#e8f4fc') : 'transparent',
                        },
                      ]}
                    >
                      {totalMins > 0 ? formatStopDuration(totalMins) : 'Tap to set'}
                    </ThemedText>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {loading && (
          <View style={styles.loadingContainer}>
            <ThemedText style={[styles.loadingText, { color: colors.sub }]}>
              Finding transit routes...
            </ThemedText>
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
              No{' '}
              {transitFilter === 'subway' ? 'metro/subway' : transitFilter === 'bus' ? 'bus' : ''}{' '}
              routes found for this trip.
            </ThemedText>
          </View>
        )}

        {filteredRoutes.map((route, routeIndex) => {
          const allSteps = route.legs.flatMap((l) => l.steps);
          const transitSteps = allSteps.filter((s) => s.mode === 'TRANSIT');
          const modes = transitSteps.map((s) => s.transitLine?.icon).join(' ');
          const lineSummary = transitSteps
            .map((s) => s.transitLine?.shortName || s.instruction)
            .join(' → ');

          const transitMins = route.legs.reduce((sum, l) => sum + parseInt(l.duration || '0'), 0);
          const totalMinsWithStops = transitMins + totalStopMins;
          const totalDisplay =
            totalMinsWithStops < 60
              ? `${totalMinsWithStops} min`
              : formatStopDuration(totalMinsWithStops);
          const departureTime = route.legs[0]?.departureTime;
          const rawArrivalTime = route.legs[route.legs.length - 1]?.arrivalTime;
          // Shift arrival forward by accumulated stop time
          const arrivalTime =
            rawArrivalTime && totalStopMins > 0 && parseTimeToMinutes(rawArrivalTime) !== null
              ? formatMinutesToTime(parseTimeToMinutes(rawArrivalTime)! + totalStopMins)
              : rawArrivalTime;

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
                  <ThemedText style={[styles.routeModes, { color: colors.text }]}>
                    {modes}
                  </ThemedText>
                  <ThemedText
                    type="defaultSemiBold"
                    style={[styles.routeSummary, { color: colors.text }]}
                  >
                    {route.summary || `Route ${routeIndex + 1}`}
                  </ThemedText>
                </View>
                <View style={styles.routeTimeRow}>
                  <ThemedText
                    type="defaultSemiBold"
                    style={[styles.routeDuration, { color: colors.accent }]}
                  >
                    {totalDisplay}
                  </ThemedText>
                  {totalStopMins > 0 && (
                    <ThemedText style={[styles.stopBreakdown, { color: colors.sub }]}>
                      {formatStopDuration(transitMins)} transit +{' '}
                      {formatStopDuration(totalStopMins)} stops
                    </ThemedText>
                  )}
                  {departureTime && arrivalTime && (
                    <ThemedText style={[styles.routeTimeRange, { color: colors.sub }]}>
                      {departureTime} – {arrivalTime}
                    </ThemedText>
                  )}
                </View>
              </View>

              {lineSummary && (
                <View style={styles.lineSummaryContainer}>
                  <ThemedText style={[styles.lineSummaryText, { color: colors.text }]}>
                    {lineSummary}
                  </ThemedText>
                </View>
              )}

              {allSteps.map((step, stepIndex) => (
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
                          <View
                            style={[styles.lineBadge, { backgroundColor: step.transitLine.color }]}
                          >
                            <ThemedText style={styles.lineName}>
                              {step.transitLine.shortName}
                            </ThemedText>
                          </View>
                          {step.numStops !== undefined && (
                            <ThemedText style={[styles.stopsText, { color: colors.sub }]}>
                              {step.numStops} stop{step.numStops !== 1 ? 's' : ''}
                            </ThemedText>
                          )}
                        </View>
                      )}

                      {step.mode === 'TRANSIT' && step.departureTime && (
                        <View style={styles.departureInfo}>
                          <ThemedText
                            style={[
                              styles.departureText,
                              { color: colors.accent, fontWeight: '600' },
                            ]}
                          >
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
                // Use the arrival time of the leg ending at this stop
                const legForStop = route.legs[i];
                const resumeTime =
                  legForStop?.arrivalTime && parseTimeToMinutes(legForStop.arrivalTime) !== null
                    ? formatMinutesToTime(parseTimeToMinutes(legForStop.arrivalTime)! + mins)
                    : null;
                return (
                  <View
                    key={i}
                    style={[
                      styles.stopDurationRow,
                      { backgroundColor: isDark ? '#3a2a10' : '#fff8e1', borderColor: '#e67e22' },
                    ]}
                  >
                    <View style={styles.stopDurationHeader}>
                      <ThemedText style={[styles.stopDurationIcon, { color: '#e67e22' }]}>
                        ⏱
                      </ThemedText>
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
    </>
  );
}

const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetBtn: {
    minWidth: 60,
  },
  sheetCancel: {
    fontSize: 16,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  sheetDone: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'right',
  },
  wheelsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  wheelColon: {
    fontSize: 28,
    fontWeight: '300',
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  previewRow: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  previewText: {
    fontSize: 15,
    fontWeight: '600',
  },
});

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
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stopRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  stopRowLabel: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  stopRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stopDurationBadge: {
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
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
  stopBreakdown: {
    fontSize: 11,
    marginTop: 2,
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

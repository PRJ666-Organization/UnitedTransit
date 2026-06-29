import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, TouchableOpacity, View, Platform } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { BookmarkLocation } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type DepartureTime = {
  sectionIndex: number;
  time: string; // ISO string or 'now'
};

export type TransitRouteInfo = {
  routeName: string;
  segmentIndex: number;
  color: string;
};

export type SegmentOption = {
  id: string;
  summary: string;
  legs: TransitLeg[];
  duration: string;
  distance: string;
  modes: string[];
  modeIcons: string;
};

export type RouteSegment = {
  index: number;
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  options: SegmentOption[];
};

export type SegmentSelection = {
  segmentIndex: number;
  selectedOptionIndex: number;
};

export type RouteInformationProps = {
  locations: BookmarkLocation[];
  name?: string;
  onClear: () => void;
  onRoutesLoaded?: (polylines: { steps: { mode: 'WALKING' | 'TRANSIT'; polyline?: string; color?: string }[] }[]) => void;
  onRouteSelected?: (routeIndex: number) => void;
  onTransitRoutesChanged?: (routes: TransitRouteInfo[]) => void;
  selectedRouteIndex?: number;
  onAddWaypoint?: () => void;
  onRemoveWaypoint?: (index: number) => void;
  onReorderStops?: (fromIndex: number, toIndex: number) => void;
  isAddingWaypoint?: boolean;
  onCancelAddWaypoint?: () => void;
  departureTimes?: DepartureTime[];
  onDepartureTimeChange?: (sectionIndex: number, time: string) => void;
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

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export default function RouteInformation({
  locations,
  name,
  onClear,
  onRoutesLoaded,
  onTransitRoutesChanged,
  onRouteSelected,
  selectedRouteIndex,
  onAddWaypoint,
  onRemoveWaypoint,
  onReorderStops,
  isAddingWaypoint,
  onCancelAddWaypoint,
  departureTimes = [],
  onDepartureTimeChange,
}: RouteInformationProps) {
  const isDark = useColorScheme() === 'dark';
  const colors = isDark
    ? { bg: '#151718', text: '#FFFFFF', sub: '#A0A4A8', border: '#3d4148', accent: '#4a9eff', cardBg: '#2a2d33', cardBorder: '#404450', danger: '#e74c3c', success: '#22c55e' }
    : { bg: '#ffffff', text: '#111', sub: '#555555', border: '#d0d0d0', accent: '#0a7ea4', cardBg: '#f8f9fa', cardBorder: '#dde0e4', danger: '#e74c3c', success: '#22c55e' };

  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routeSegments, setRouteSegments] = useState<RouteSegment[]>([]);
  const [segmentSelections, setSegmentSelections] = useState<SegmentSelection[]>([]);
  const [timePickerSegment, setTimePickerSegment] = useState<number | null>(null);

  // Generate time options in 15-minute increments for next 12 hours
  const generateTimeOptions = useCallback(() => {
    const options: { value: string; label: string }[] = [];
    const now = new Date();
    now.setSeconds(0, 0);

    // Round up to next 15-minute increment
    const minutes = now.getMinutes();
    const roundedMinutes = Math.ceil(minutes / 15) * 15;
    if (roundedMinutes >= 60) {
      now.setHours(now.getHours() + 1, 0, 0, 0);
    } else {
      now.setMinutes(roundedMinutes, 0, 0);
    }

    // Generate options for next 12 hours
    for (let i = 0; i < 48; i++) {
      const time = new Date(now.getTime() + i * 15 * 60 * 1000);
      const hours = time.getHours();
      const mins = time.getMinutes();
      const period = hours >= 12 ? 'pm' : 'am';
      const displayHour = hours % 12 || 12;
      const label = `${displayHour}:${String(mins).padStart(2, '0')} ${period}`;
      options.push({ value: time.toISOString(), label });
    }
    return options;
  }, []);

  const fetchDirections = useCallback(async () => {
    if (locations.length < 2) return;
    setLoading(true);
    setError(null);
    setRouteSegments([]); // Reset segments on new fetch
    try {
      const origin = `${locations[0].latitude},${locations[0].longitude}`;
      const destination = `${locations[locations.length - 1].latitude},${locations[locations.length - 1].longitude}`;

      // Build URL with waypoints for multi-stop routes
      let url = `${API_URL}/transit-route?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`;

      // Add waypoints if there are intermediate stops
      if (locations.length > 2) {
        const waypoints = locations
          .slice(1, -1) // Exclude origin and destination
          .map(loc => `${loc.latitude},${loc.longitude}`)
          .join('|');
        url += `&waypoints=${encodeURIComponent(waypoints)}`;
      }

      // Add departure time for first section if specified
      const firstSectionDeparture = departureTimes.find(d => d.sectionIndex === 0);
      if (firstSectionDeparture && firstSectionDeparture.time !== 'now') {
        const departureTimestamp = Math.floor(new Date(firstSectionDeparture.time).getTime() / 1000);
        url += `&departure_time=${departureTimestamp}`;
      }

      const res = await fetch(url);
      const json = await res.json();

      if (json.error) {
        setError(json.error);
        setRoutes([]);
        setRouteSegments([]);
      } else if (json.type === 'multi-stop') {
        // New multi-stop format with segment options
        setRouteSegments(json.segments);
        // Default selections: first (fastest) option for each segment
        const defaultSelections: SegmentSelection[] = json.segments.map((seg: RouteSegment) => ({
          segmentIndex: seg.index,
          selectedOptionIndex: 0,
        }));
        setSegmentSelections(defaultSelections);
        setRoutes([]); // Will be computed from selections
      } else {
        // Legacy single-stop format
        const allRoutes = json.routes || [{ summary: '', legs: json.legs || [] }];
        setRoutes(allRoutes);
        setRouteSegments([]);
      }
    } catch (e) {
      setError('Failed to fetch directions');
      console.error('Directions fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [locations, departureTimes]);

  useEffect(() => {
    if (locations.length >= 2) {
      fetchDirections();
    } else {
      setRoutes([]);
      setError(null);
      onRoutesLoaded?.([]);
    }
  }, [locations, fetchDirections]);

  // Combine selected segments into a complete route for multi-stop
  const combinedRoute = useMemo(() => {
    if (routeSegments.length === 0 || segmentSelections.length === 0) return null;

    const combinedLegs: TransitLeg[] = [];
    let totalDuration = 0;

    // Iterate segments in order, not selections
    for (let i = 0; i < routeSegments.length; i++) {
      const selection = segmentSelections.find(s => s.segmentIndex === i);
      if (!selection) continue;

      const segment = routeSegments[i];
      if (!segment) continue;
      const option = segment.options[selection.selectedOptionIndex];
      if (!option) continue;

      combinedLegs.push(...option.legs);
      const durMatch = option.duration.match(/(\d+)/);
      if (durMatch) {
        totalDuration += parseInt(durMatch[1]);
      }
    }

    return {
      summary: `Multi-stop Route (${totalDuration} min)`,
      legs: combinedLegs,
    };
  }, [routeSegments, segmentSelections]);

  // Handle segment option selection
  const handleSegmentOptionSelect = useCallback((segmentIndex: number, optionIndex: number) => {
    setSegmentSelections(prev => {
      const filtered = prev.filter(s => s.segmentIndex !== segmentIndex);
      return [...filtered, { segmentIndex, selectedOptionIndex: optionIndex }];
    });
  }, []);

  // Helper to parse duration string (e.g., "15 min" → 15)
  const parseDurationMinutes = useCallback((duration: string): number => {
    const match = duration.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }, []);

  // Handle departure time change with cascading to subsequent segments
  const handleDepartureTimeChangeWithCascade = useCallback((segmentIndex: number, time: string) => {
    // Set the current segment's departure time
    onDepartureTimeChange?.(segmentIndex, time);

    // For multi-stop routes, cascade to subsequent segments
    if (routeSegments.length === 0 || segmentSelections.length === 0) return;

    // Only cascade if we have a specific time (not 'now')
    if (time === 'now') return;

    let currentTime = new Date(time);

    // Cascade to subsequent segments
    for (let i = segmentIndex; i < routeSegments.length - 1; i++) {
      const selection = segmentSelections.find(s => s.segmentIndex === i);
      if (!selection) continue;

      const segment = routeSegments[i];
      if (!segment) continue;

      const option = segment.options[selection.selectedOptionIndex];
      if (!option) continue;

      // Add duration to get arrival time at this segment
      const durationMinutes = parseDurationMinutes(option.duration);
      currentTime = new Date(currentTime.getTime() + durationMinutes * 60 * 1000);

      // Round to nearest 15 minutes for the next segment's departure
      const roundedMinutes = Math.ceil(currentTime.getMinutes() / 15) * 15;
      if (roundedMinutes >= 60) {
        currentTime.setHours(currentTime.getHours() + 1, 0, 0, 0);
      } else {
        currentTime.setMinutes(roundedMinutes, 0, 0);
      }

      // Set the next segment's departure time
      const nextSegmentIndex = i + 1;
      onDepartureTimeChange?.(nextSegmentIndex, currentTime.toISOString());
    }
  }, [routeSegments, segmentSelections, onDepartureTimeChange, parseDurationMinutes]);

  // Notify parent when routes are loaded (for single-stop) or segments change (for multi-stop)
  useEffect(() => {
    // Multi-stop: use combined route
    if (combinedRoute) {
      const allSteps = combinedRoute.legs.flatMap(leg => leg.steps);
      onRoutesLoaded?.([{
        steps: allSteps.map(step => ({
          mode: step.mode,
          polyline: step.polyline,
          color: step.transitLine?.color,
        })),
      }]);
      return;
    }

    // Single-stop: use regular routes
    if (routes.length > 0 && onRoutesLoaded) {
      const polylines = routes.map(route => {
        const allSteps = route.legs.flatMap(leg => leg.steps);
        return {
          steps: allSteps.map(step => ({
            mode: step.mode,
            polyline: step.polyline,
            color: step.transitLine?.color,
          })),
        };
      });
      onRoutesLoaded(polylines);
    }
  }, [combinedRoute, routes, onRoutesLoaded]);

  // Get routes to display (combined for multi-stop, regular for single)
  const displayRoutes = useMemo(() => {
    if (combinedRoute) {
      return [combinedRoute];
    }
    return routes;
  }, [combinedRoute, routes]);

  // Notify parent of transit routes for live vehicle tracking
  useEffect(() => {
    if (!onTransitRoutesChanged) return;

    // Segment colors for multi-stop trips
    const segmentColors = ['#e74c3c', '#3498db', '#27ae60', '#9b59b6', '#f39c12', '#1abc9c'];
    const transitRoutes: TransitRouteInfo[] = [];

    // For multi-stop routes, extract routes from combinedRoute with segment info
    if (combinedRoute) {
      combinedRoute.legs.forEach((leg, legIndex) => {
        leg.steps
          .filter((step) => step.mode === 'TRANSIT' && step.transitLine?.shortName)
          .forEach((step) => {
            transitRoutes.push({
              routeName: step.transitLine!.shortName,
              segmentIndex: legIndex,
              color: step.transitLine!.color || segmentColors[legIndex % segmentColors.length],
            });
          });
      });
    } else {
      // For single routes, use the route color
      routes.forEach((route) => {
        route.legs.forEach((leg, legIndex) => {
          leg.steps
            .filter((step) => step.mode === 'TRANSIT' && step.transitLine?.shortName)
            .forEach((step) => {
              transitRoutes.push({
                routeName: step.transitLine!.shortName,
                segmentIndex: legIndex,
                color: step.transitLine!.color || '#e74c3c',
              });
            });
        });
      });
    }

    onTransitRoutesChanged(transitRoutes);
  }, [combinedRoute, routes, onTransitRoutesChanged]);

  // Get label for location - all numbered (1, 2, 3, etc.)
  const getLocationLabel = (index: number): string => {
    return String(index + 1); // 1, 2, 3, etc.
  };

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

      {/* Stops/Waypoints Section */}
      {locations.length >= 2 && (
        <View style={[styles.stopsSection, { borderBottomColor: colors.border }]}>
          <View style={styles.stopsHeader}>
            <ThemedText style={[styles.stopsTitle, { color: colors.sub }]}>Stops</ThemedText>
            {onAddWaypoint && locations.length < 5 && (
              <TouchableOpacity onPress={onAddWaypoint} style={styles.addStopBtn}>
                <ThemedText style={[styles.addStopText, { color: colors.accent }]}>+ Add Stop</ThemedText>
              </TouchableOpacity>
            )}
          </View>

          {/* Waypoint Mode Banner */}
          {isAddingWaypoint && (
            <View style={[styles.waypointBanner, { backgroundColor: isDark ? '#1a3a4a' : '#e8f4fc', borderColor: colors.accent }]}>
              <ThemedText style={[styles.waypointBannerText, { color: colors.text }]}>
                📍 Search a location to add as waypoint
              </ThemedText>
              {onCancelAddWaypoint && (
                <TouchableOpacity onPress={onCancelAddWaypoint}>
                  <ThemedText style={[styles.cancelBtn, { color: colors.danger }]}>Cancel</ThemedText>
                </TouchableOpacity>
              )}
            </View>
          )}

          {locations.map((loc, index) => {
            const isOrigin = index === 0;
            const isDestination = index === locations.length - 1;
            const label = getLocationLabel(index);
            // Allow reordering any stop
            const canMoveUp = index > 0;
            const canMoveDown = index < locations.length - 1;

            return (
              <View key={`${loc.latitude}-${loc.longitude}-${index}`} style={styles.stopRow}>
                {/* Drag Handle and Label */}
                <View style={styles.stopRowLeft}>
                  {onReorderStops && locations.length > 1 && (
                    <View style={styles.dragHandleContainer}>
                      <TouchableOpacity
                        style={[styles.dragBtn, { opacity: canMoveUp ? 1 : 0.3 }]}
                        disabled={!canMoveUp}
                        onPress={() => onReorderStops(index, index - 1)}
                      >
                        <ThemedText style={styles.dragBtnText}>▲</ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.dragBtn, { opacity: canMoveDown ? 1 : 0.3 }]}
                        disabled={!canMoveDown}
                        onPress={() => onReorderStops(index, index + 1)}
                      >
                        <ThemedText style={styles.dragBtnText}>▼</ThemedText>
                      </TouchableOpacity>
                    </View>
                  )}
                  {/* Label Circle - numbered with color coding */}
                  <View style={[
                    styles.stopLabelCircle,
                    { backgroundColor: isOrigin ? colors.success : isDestination ? colors.danger : colors.accent }
                  ]}>
                    <ThemedText style={styles.stopLabelText}>{label}</ThemedText>
                  </View>
                </View>

                {/* Stop Info */}
                <View style={styles.stopInfo}>
                  <ThemedText style={[styles.stopName, { color: colors.text }]} numberOfLines={1}>
                    {loc.name || `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`}
                  </ThemedText>
                  <ThemedText style={[styles.stopType, { color: colors.sub }]}>
                    {isOrigin ? 'Start' : isDestination ? 'End' : 'Stop ' + label}
                  </ThemedText>
                </View>

                {/* Remove Button - only for stops that aren't the only ones */}
                {locations.length > 2 && onRemoveWaypoint && (
                  <TouchableOpacity style={styles.removeStopBtn} onPress={() => onRemoveWaypoint(index)}>
                    <ThemedText style={[styles.removeStopText, { color: colors.danger }]}>✕</ThemedText>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}

          {/* Visual Route Preview */}
          {locations.length >= 2 && (
            <View style={styles.routePreviewContainer}>
              <View style={styles.routePreviewLine}>
                {locations.map((_, index) => (
                  <View key={index} style={styles.routePreviewSegment}>
                    <View style={[
                      styles.routePreviewDot,
                      { backgroundColor: index === 0 ? colors.success : index === locations.length - 1 ? colors.danger : colors.accent }
                    ]} />
                    {index < locations.length - 1 && <View style={[styles.routePreviewConnector, { backgroundColor: colors.border }]} />}
                  </View>
                ))}
              </View>
              <ThemedText style={[styles.routePreviewText, { color: colors.sub }]}>
                {locations.length} stop{locations.length !== 1 ? 's' : ''} • Route follows this order
              </ThemedText>
            </View>
          )}
        </View>
      )}

      {loading && (
        <View style={styles.loadingContainer}>
          <ThemedText style={[styles.loadingText, { color: colors.sub }]}>Finding transit routes...</ThemedText>
        </View>
      )}

      {error && displayRoutes.length === 0 && (
        <View style={styles.errorContainer}>
          <ThemedText style={[styles.errorText, { color: '#e74c3c' }]}>{error}</ThemedText>
        </View>
      )}

      {displayRoutes.map((route, routeIndex) => {
        const isSelected = selectedRouteIndex === routeIndex;

        // Calculate total duration across all legs
        const totalDuration = route.legs.reduce((acc, leg) => {
          const mins = parseInt(leg.duration) || 0;
          return acc + mins;
        }, 0);

        // Get all transit modes across all legs
        const allTransitSteps = route.legs.flatMap(leg => leg.steps.filter(s => s.mode === 'TRANSIT'));
        const modes = [...new Set(allTransitSteps.map(s => s.transitLine?.icon))].filter(Boolean).join(' ');

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
                  {totalDuration} min total
                </ThemedText>
                {route.legs[0]?.departureTime && route.legs[route.legs.length - 1]?.arrivalTime && (
                  <ThemedText style={[styles.routeTimeRange, { color: colors.sub }]}>
                    {route.legs[0].departureTime} – {route.legs[route.legs.length - 1].arrivalTime}
                  </ThemedText>
                )}
              </View>
            </View>

            {/* Render each leg/section of the trip */}
            {route.legs.map((leg, legIndex) => {
              const sectionStart = legIndex + 1;
              const sectionEnd = legIndex + 2;
              const sectionTitle = `Section ${sectionStart} → ${sectionEnd}`;
              const transitSteps = leg.steps.filter(s => s.mode === 'TRANSIT');

              // Get departure time for this section
              const sectionDeparture = departureTimes.find(d => d.sectionIndex === legIndex);
              const departureTime = sectionDeparture?.time || 'now';
              const isNow = departureTime === 'now';

              // Format time for display
              const formatDisplayTime = (time: string): string => {
                if (time === 'now') return 'Now';
                try {
                  const date = new Date(time);
                  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                } catch {
                  return 'Now';
                }
              };

              return (
                <View key={legIndex} style={styles.sectionContainer}>
                  {/* Section Header */}
                  <View style={[styles.sectionHeader, { borderBottomColor: colors.border }]}>
                    <View style={[styles.sectionNumberBadge, { backgroundColor: colors.accent }]}>
                      <ThemedText style={styles.sectionNumberText}>{sectionStart}→{sectionEnd}</ThemedText>
                    </View>
                    <View style={styles.sectionInfo}>
                      <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>{sectionTitle}</ThemedText>
                      <ThemedText style={[styles.sectionMeta, { color: colors.sub }]}>
                        {leg.duration}
                        {leg.distance && ` • ${leg.distance}`}
                        {transitSteps.length > 0 && ` • ${transitSteps.length} transit line${transitSteps.length > 1 ? 's' : ''}`}
                      </ThemedText>
                    </View>
                  </View>

                  {/* Segment Options Selector (for multi-stop routes) */}
                  {routeSegments[legIndex] && routeSegments[legIndex].options.length > 1 && (
                    <View style={styles.segmentOptionsContainer}>
                      <ThemedText style={[styles.segmentOptionsLabel, { color: colors.sub }]}>
                        Route options:
                      </ThemedText>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.segmentOptionsScroll}
                      >
                        {routeSegments[legIndex].options.map((option, optIdx) => {
                          const selection = segmentSelections.find(s => s.segmentIndex === legIndex);
                          const isSelected = selection?.selectedOptionIndex === optIdx;
                          return (
                            <TouchableOpacity
                              key={option.id}
                              style={[
                                styles.segmentOptionBtn,
                                {
                                  backgroundColor: isSelected ? colors.accent : 'transparent',
                                  borderColor: colors.accent,
                                }
                              ]}
                              onPress={() => handleSegmentOptionSelect(legIndex, optIdx)}
                            >
                              <ThemedText style={styles.segmentOptionIcon}>{option.modeIcons}</ThemedText>
                              <ThemedText style={[
                                styles.segmentOptionDuration,
                                { color: isSelected ? '#fff' : colors.text }
                              ]}>
                                {option.duration}
                              </ThemedText>
                              {option.summary && (
                                <ThemedText style={[
                                  styles.segmentOptionSummary,
                                  { color: isSelected ? 'rgba(255,255,255,0.8)' : colors.sub }
                                ]} numberOfLines={1}>
                                  {option.summary}
                                </ThemedText>
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}

                  {/* Departure Time Selector */}
                  {onDepartureTimeChange && (
                    <View style={styles.departureTimeRow}>
                      <ThemedText style={[styles.departureTimeLabel, { color: colors.sub }]}>
                        Departure:
                      </ThemedText>
                      <View style={styles.departureTimeButtons}>
                        <TouchableOpacity
                          style={[
                            styles.departureTimeBtn,
                            {
                              backgroundColor: isNow ? colors.accent : 'transparent',
                              borderColor: colors.accent
                            }
                          ]}
                          onPress={() => handleDepartureTimeChangeWithCascade(legIndex, 'now')}
                        >
                          <ThemedText style={[
                            styles.departureTimeBtnText,
                            { color: isNow ? '#fff' : colors.accent }
                          ]}>
                            Now
                          </ThemedText>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.departureTimeBtn,
                            {
                              backgroundColor: !isNow ? colors.accent : 'transparent',
                              borderColor: colors.accent
                            }
                          ]}
                          onPress={() => setTimePickerSegment(legIndex)}
                        >
                          <ThemedText style={[
                            styles.departureTimeBtnText,
                            { color: !isNow ? '#fff' : colors.accent }
                          ]}>
                            {isNow ? 'Set Time' : formatDisplayTime(departureTime)}
                          </ThemedText>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* Time Picker Modal */}
                  <Modal
                    visible={timePickerSegment === legIndex}
                    transparent
                    animationType="slide"
                    onRequestClose={() => setTimePickerSegment(null)}
                  >
                    <View style={styles.modalOverlay}>
                      <View style={[styles.timePickerModal, { backgroundColor: colors.cardBg }]}>
                        <View style={[styles.timePickerHeader, { borderBottomColor: colors.border }]}>
                          <ThemedText style={[styles.timePickerTitle, { color: colors.text }]}>
                            Select Departure Time
                          </ThemedText>
                          <TouchableOpacity onPress={() => setTimePickerSegment(null)}>
                            <ThemedText style={[styles.timePickerClose, { color: colors.accent }]}>
                              Done
                            </ThemedText>
                          </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.timePickerScroll} showsVerticalScrollIndicator>
                          <TouchableOpacity
                            style={[styles.timeOption, { borderBottomColor: colors.border }]}
                            onPress={() => {
                              handleDepartureTimeChangeWithCascade(legIndex, 'now');
                              setTimePickerSegment(null);
                            }}
                          >
                            <ThemedText style={[styles.timeOptionText, { color: isNow ? colors.accent : colors.text }]}>
                              Now
                            </ThemedText>
                            {isNow && <ThemedText style={[styles.timeOptionCheck, { color: colors.accent }]}>✓</ThemedText>}
                          </TouchableOpacity>
                          {generateTimeOptions().map((option) => {
                            const isSelected = !isNow && departureTime === option.value;
                            return (
                              <TouchableOpacity
                                key={option.value}
                                style={[styles.timeOption, { borderBottomColor: colors.border }]}
                                onPress={() => {
                                  handleDepartureTimeChangeWithCascade(legIndex, option.value);
                                  setTimePickerSegment(null);
                                }}
                              >
                                <ThemedText style={[styles.timeOptionText, { color: isSelected ? colors.accent : colors.text }]}>
                                  {option.label}
                                </ThemedText>
                                {isSelected && <ThemedText style={[styles.timeOptionCheck, { color: colors.accent }]}>✓</ThemedText>}
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      </View>
                    </View>
                  </Modal>

                  {/* Section Steps */}
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
                            <View style={styles.stopInfoBlock}>
                              <ThemedText style={[styles.stopTextInfo, { color: colors.sub }]}>
                                From: {step.from}
                              </ThemedText>
                              <ThemedText style={[styles.stopTextInfo, { color: colors.sub }]}>
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
                    </View>
                  ))}
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
  // Stops/Waypoints Section
  stopsSection: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  stopsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  stopsTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  addStopBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  addStopText: {
    fontSize: 14,
    fontWeight: '600',
  },
  waypointBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 8,
  },
  waypointBannerText: {
    fontSize: 13,
    fontWeight: '500',
  },
  cancelBtn: {
    fontSize: 13,
    fontWeight: '600',
  },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  stopRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dragHandleContainer: {
    flexDirection: 'column',
    marginRight: 4,
    gap: 0,
  },
  dragBtn: {
    padding: 2,
  },
  dragBtnText: {
    fontSize: 10,
    color: '#666',
  },
  stopLabelCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  stopLabelText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  stopInfo: {
    flex: 1,
  },
  stopName: {
    fontSize: 14,
    fontWeight: '500',
  },
  stopType: {
    fontSize: 11,
    marginTop: 1,
  },
  removeStopBtn: {
    padding: 6,
  },
  removeStopText: {
    fontSize: 16,
    fontWeight: '600',
  },
  // Route Preview
  routePreviewContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150, 150, 150, 0.3)',
  },
  routePreviewLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  routePreviewSegment: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routePreviewDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  routePreviewConnector: {
    width: 20,
    height: 2,
  },
  routePreviewText: {
    fontSize: 11,
    textAlign: 'center',
  },
  // Filter
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
  // Route Card
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
  // Section styles
  sectionContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150, 150, 150, 0.2)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionNumberBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 10,
  },
  sectionNumberText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionInfo: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  sectionMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  // Segment options selector
  segmentOptionsContainer: {
    marginBottom: 10,
    marginTop: 8,
  },
  segmentOptionsLabel: {
    fontSize: 12,
    marginBottom: 6,
  },
  segmentOptionsScroll: {
    flexDirection: 'row',
  },
  segmentOptionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  segmentOptionIcon: {
    fontSize: 16,
    marginBottom: 2,
  },
  segmentOptionDuration: {
    fontSize: 13,
    fontWeight: '600',
  },
  segmentOptionSummary: {
    fontSize: 10,
    maxWidth: 100,
  },
  // Departure time selector
  departureTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 4,
  },
  departureTimeLabel: {
    fontSize: 13,
    marginRight: 10,
  },
  departureTimeButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  departureTimeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  departureTimeBtnText: {
    fontSize: 13,
    fontWeight: '500',
  },
  // Time picker modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  timePickerModal: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '60%',
    minHeight: 200,
  },
  timePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  timePickerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  timePickerClose: {
    fontSize: 16,
    fontWeight: '600',
  },
  timePickerScroll: {
    paddingHorizontal: 8,
  },
  timeOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  timeOptionText: {
    fontSize: 16,
  },
  timeOptionCheck: {
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
  stopInfoBlock: {
    marginBottom: 4,
    marginTop: 2,
  },
  stopTextInfo: {
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
});
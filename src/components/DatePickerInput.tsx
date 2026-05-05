/**
 * DatePickerInput
 *
 * Cross-platform date + time picker — premium two-row card design.
 * - iOS:     Inline picker inside a bottom sheet modal.
 * - Android: Native date dialog followed by time dialog (sequential).
 *
 * Usage:
 *   <DatePickerInput
 *     label="Event Date & Time"
 *     value={dateMs}           // unix ms or undefined
 *     onChange={(ms) => setDate(ms)}
 *     error={errors.date}
 *     minDate={Date.now()}     // optional
 *   />
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Platform,
} from 'react-native';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, AppColors } from '../utils/useTheme';
import { spacing, radius } from '../utils/theme';

interface Props {
  label?:   string;
  value?:   number;          // unix ms
  onChange: (ms: number) => void;
  error?:   string;
  minDate?: number;          // unix ms
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtDate(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    day:     '2-digit',
    month:   'short',
    year:    'numeric',
  });
  // → "Tue, 15 May 2026"
}

function fmtTime(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString('en-US', {
    hour:   'numeric',
    minute: '2-digit',
    hour12: true,
  });
  // → "7:30 PM"
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DatePickerInput({ label, value, onChange, error, minDate }: Props) {
  const { C } = useTheme();
  const styles = makeStyles(C);

  const [showPicker,   setShowPicker]   = useState(false);
  // Android needs two steps: date then time
  const [androidStep,  setAndroidStep]  = useState<'date' | 'time'>('date');
  const [pendingDate,  setPendingDate]  = useState<Date | null>(null);

  const current = value ? new Date(value) : new Date();

  // ── Android ──────────────────────────────────────────────────────────────────
  function handleAndroid(event: DateTimePickerEvent, selected?: Date) {
    if (event.type === 'dismissed') {
      setShowPicker(false);
      setAndroidStep('date');
      return;
    }
    if (!selected) return;

    if (androidStep === 'date') {
      setPendingDate(selected);
      setAndroidStep('time');
    } else {
      const base = pendingDate ?? current;
      const merged = new Date(
        base.getFullYear(), base.getMonth(), base.getDate(),
        selected.getHours(), selected.getMinutes(),
      );
      onChange(merged.getTime());
      setShowPicker(false);
      setAndroidStep('date');
      setPendingDate(null);
    }
  }

  // ── iOS ──────────────────────────────────────────────────────────────────────
  function handleIos(_: DateTimePickerEvent, selected?: Date) {
    if (selected) onChange(selected.getTime());
  }

  function openPicker() {
    setShowPicker(true);
    setAndroidStep('date');
  }

  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}

      {/* ── Two-row card ── */}
      <View style={[styles.card, error ? styles.cardError : null]}>

        {/* Date row */}
        <TouchableOpacity style={styles.row} onPress={openPicker} activeOpacity={0.75}>
          <LinearGradient colors={['#FF4B6E', '#C2185B']} style={styles.iconBg} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Ionicons name="calendar-outline" size={15} color="#fff" />
          </LinearGradient>
          <Text style={styles.rowLabel}>Date</Text>
          <Text style={[styles.rowValue, !value && styles.rowPlaceholder]} numberOfLines={1}>
            {value ? fmtDate(value) : 'Select date →'}
          </Text>
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Time row */}
        <TouchableOpacity style={styles.row} onPress={openPicker} activeOpacity={0.75}>
          <LinearGradient colors={['#6C5CE7', '#4834D4']} style={styles.iconBg} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Ionicons name="time-outline" size={15} color="#fff" />
          </LinearGradient>
          <Text style={styles.rowLabel}>Time</Text>
          <Text style={[styles.rowValue, !value && styles.rowPlaceholder]} numberOfLines={1}>
            {value ? fmtTime(value) : 'Select time →'}
          </Text>
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {/* Android — native dialogs triggered sequentially */}
      {Platform.OS === 'android' && showPicker && (
        <DateTimePicker
          value={androidStep === 'time' && pendingDate ? pendingDate : current}
          mode={androidStep}
          display="default"
          minimumDate={minDate ? new Date(minDate) : undefined}
          onChange={handleAndroid}
        />
      )}

      {/* iOS — bottom sheet modal with inline spinner */}
      {Platform.OS === 'ios' && (
        <Modal
          visible={showPicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowPicker(false)}
        >
          <View style={styles.iosOverlay}>
            <View style={styles.iosSheet}>
              <View style={styles.iosHeader}>
                <Text style={styles.iosTitle}>Date & Time</Text>
                <TouchableOpacity onPress={() => setShowPicker(false)} style={styles.iosDoneBtn}>
                  <Text style={styles.iosDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={current}
                mode="datetime"
                display="spinner"
                minimumDate={minDate ? new Date(minDate) : undefined}
                onChange={handleIos}
                style={styles.iosPicker}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    wrapper: { marginBottom: spacing.md },

    label: {
      fontSize:      12,
      fontWeight:    '600',
      color:         C.textSecondary,
      marginBottom:  spacing.xs,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },

    // ── Card container ──
    card: {
      backgroundColor: C.surface,
      borderRadius:    14,
      borderWidth:     1.5,
      borderColor:     C.border,
      overflow:        'hidden',
    },
    cardError: { borderColor: C.error },

    // ── Row ──
    row: {
      flexDirection:  'row',
      alignItems:     'center',
      gap:            12,
      paddingHorizontal: spacing.md,
      paddingVertical:   13,
    },

    iconBg: {
      width:        30,
      height:       30,
      borderRadius: 8,
      alignItems:   'center',
      justifyContent: 'center',
    },

    rowLabel: {
      fontSize:   13,
      fontWeight: '600',
      color:      C.textSecondary,
      width:      38,
    },

    rowValue: {
      flex:       1,
      fontSize:   14,
      fontWeight: '700',
      color:      C.text,
      textAlign:  'right',
    },
    rowPlaceholder: {
      fontWeight: '400',
      color:      C.textSecondary,
    },

    divider: {
      height:          1,
      backgroundColor: C.border,
      marginHorizontal: spacing.md,
    },

    errorText: {
      fontSize:  12,
      color:     C.error,
      marginTop: spacing.xs,
    },

    // ── iOS modal ──
    iosOverlay: {
      flex:            1,
      justifyContent:  'flex-end',
      backgroundColor: 'rgba(0,0,0,0.4)',
    },
    iosSheet: {
      backgroundColor:      C.background,
      borderTopLeftRadius:  20,
      borderTopRightRadius: 20,
      paddingBottom:        36,
    },
    iosHeader: {
      flexDirection:   'row',
      alignItems:      'center',
      justifyContent:  'space-between',
      padding:         spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    iosTitle: {
      fontSize:   16,
      fontWeight: '700',
      color:      C.text,
    },
    iosDoneBtn: {
      paddingHorizontal: 4,
      paddingVertical:   2,
    },
    iosDone: {
      fontSize:   15,
      color:      C.primary,
      fontWeight: '700',
    },
    iosPicker: { height: 200 },
  });
}

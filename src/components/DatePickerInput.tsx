/**
 * DatePickerInput
 *
 * Cross-platform date + time picker.
 * - iOS:     Inline picker inside a modal sheet.
 * - Android: Native date dialog followed by time dialog.
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
import { useTheme, AppColors, spacing, typography, radius } from '../utils/useTheme';

interface Props {
  label?:   string;
  value?:   number;          // unix ms
  onChange: (ms: number) => void;
  error?:   string;
  minDate?: number;          // unix ms
}

function fmt(ms: number): string {
  const d = new Date(ms);
  const date = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${date}  ${time}`;
}

export default function DatePickerInput({ label, value, onChange, error, minDate }: Props) {
  const { C } = useTheme();
  const styles = makeStyles(C);

  const [showPicker, setShowPicker] = useState(false);
  // Android needs two steps: date then time
  const [androidStep, setAndroidStep] = useState<'date' | 'time'>('date');
  const [pendingDate, setPendingDate]  = useState<Date | null>(null);

  const current = value ? new Date(value) : new Date();

  // ─── Android ────────────────────────────────────────────────────────────────
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
      // Merge date from pendingDate with time from selected
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

  // ─── iOS ────────────────────────────────────────────────────────────────────
  function handleIos(_: DateTimePickerEvent, selected?: Date) {
    if (selected) onChange(selected.getTime());
  }

  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}

      <TouchableOpacity
        style={[styles.field, error ? styles.fieldErr : null]}
        onPress={() => { setShowPicker(true); setAndroidStep('date'); }}
        activeOpacity={0.75}
      >
        <Text style={styles.calIcon}>📅</Text>
        <Text style={[styles.valueText, !value && styles.placeholder]}>
          {value ? fmt(value) : 'Tap to pick date & time'}
        </Text>
      </TouchableOpacity>

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

      {/* iOS — modal sheet with inline spinner */}
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
                <TouchableOpacity onPress={() => setShowPicker(false)}>
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

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    wrapper: { marginBottom: spacing.md },

    label: {
      ...typography.caption,
      fontWeight:    '600',
      color:         C.textSecondary,
      marginBottom:  spacing.xs,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },

    field: {
      flexDirection:   'row',
      alignItems:      'center',
      gap:             spacing.sm,
      height:          52,
      borderWidth:     1.5,
      borderColor:     C.border,
      borderRadius:    radius.md,
      backgroundColor: C.surface,
      paddingHorizontal: spacing.md,
    },
    fieldErr: { borderColor: C.error },

    calIcon:     { fontSize: 18 },
    valueText:   { ...typography.body, color: C.text, flex: 1 },
    placeholder: { color: C.textSecondary },

    errorText: {
      ...typography.small,
      color:      C.error,
      marginTop:  spacing.xs,
    },

    // iOS modal
    iosOverlay: {
      flex:            1,
      justifyContent:  'flex-end',
      backgroundColor: 'rgba(0,0,0,0.35)',
    },
    iosSheet: {
      backgroundColor: C.background,
      borderTopLeftRadius:  16,
      borderTopRightRadius: 16,
      paddingBottom: 32,
    },
    iosHeader: {
      flexDirection:  'row',
      justifyContent: 'flex-end',
      padding:        spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    iosDone:   { ...typography.body, color: C.primary, fontWeight: '700' },
    iosPicker: { height: 200 },
  });
}

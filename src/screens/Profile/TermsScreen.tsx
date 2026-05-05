import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { spacing, typography, radius } from '../../utils/theme';
import { useTheme, AppColors } from '../../utils/useTheme';

type Tab = 'terms' | 'privacy';

const TERMS_CONTENT = `Last updated: April 2026

**1. Acceptance of Terms**
By using Drift, you agree to these Terms of Service. If you do not agree, do not use the app.

**2. Eligibility**
You must be at least 13 years old to use Drift. By registering, you represent that you meet this requirement.

**3. User Conduct**
You agree not to:
- Harass, abuse, or harm other users
- Post false, misleading, or offensive content
- Impersonate other people
- Use the platform for commercial solicitation without permission
- Attempt to access unauthorized areas of the service

**4. Content**
You retain ownership of content you post. By posting, you grant Drift a non-exclusive license to display it within the app. We reserve the right to remove content that violates these terms.

**5. Connections & Meetups**
Drift facilitates connections between users. We are not responsible for the conduct of users in real-world meetups. Always meet in public places and exercise personal safety.

**6. Drift Coins**
Drift Coins are a virtual currency with no monetary value. They cannot be exchanged for cash. Earned coins may be used for in-app features. Purchased coins are non-refundable unless required by law.

**7. Account Termination**
We may suspend or terminate accounts that violate these terms, at our discretion.

**8. Disclaimer**
Drift is provided "as is" without warranties. We are not liable for damages arising from your use of the service.

**9. Changes**
We may update these terms. Continued use after updates constitutes acceptance.

**10. Contact**
For questions: support@driftapp.in`;

const PRIVACY_CONTENT = `Last updated: April 2026

**What we collect**
- Phone number (for authentication only)
- Profile information you provide (name, bio, photos, interests)
- Usage data (login times, interactions) to improve the app
- Location only if you voluntarily drop it in a status post

**What we DON'T collect**
- We never share your phone number with other users
- We never sell your data to third parties
- We don't track your real-time location

**How we use your data**
- To show your profile in the discovery feed
- To facilitate connections between users
- To calculate your vibe compatibility score
- To award Drift Coins for engagement

**Data storage**
Your data is stored securely in Firebase (Google Cloud). Profile photos are stored in Firebase Storage. Messages are stored in Firebase Realtime Database and are end-to-end accessible only to conversation participants.

**Your rights**
- You can edit or delete your profile information at any time
- You can delete your account from Profile settings
- You can control who sees your status and memories in Privacy Settings
- You can request a copy of your data by contacting us

**Cookies & Analytics**
We use Firebase Analytics to understand app usage. This is anonymous and aggregated.

**Contact**
privacy@driftapp.in`;

function ContentView({ content, C }: { content: string; C: AppColors }) {
  const contentStyles = makeContentStyles(C);
  const paragraphs = content.split('\n\n');
  return (
    <ScrollView contentContainerStyle={contentStyles.container} showsVerticalScrollIndicator={false}>
      {paragraphs.map((para, i) => {
        if (para.startsWith('**') && para.endsWith('**') && !para.slice(2, -2).includes('\n')) {
          return <Text key={i} style={contentStyles.heading}>{para.slice(2, -2)}</Text>;
        }
        const parts = para.split(/\*\*(.*?)\*\*/g);
        return (
          <Text key={i} style={contentStyles.body}>
            {parts.map((p, j) => j % 2 === 1
              ? <Text key={j} style={contentStyles.bold}>{p}</Text>
              : p
            )}
          </Text>
        );
      })}
    </ScrollView>
  );
}

function makeContentStyles(C: AppColors) {
  return StyleSheet.create({
    container: { padding: spacing.lg, paddingBottom: spacing.xxl },
    heading: { ...typography.body, fontWeight: '700', color: C.text, marginTop: spacing.lg, marginBottom: spacing.xs },
    body: { ...typography.body, color: C.textSecondary, lineHeight: 26, marginBottom: spacing.sm },
    bold: { fontWeight: '600', color: C.text },
  });
}

export default function TermsScreen() {
  const navigation = useNavigation();
  const { C, isDark } = useTheme();
  const styles = makeStyles(C);
  const [activeTab, setActiveTab] = useState<Tab>('terms');

  return (
    <SafeAreaView style={styles.flex}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Legal</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'terms' && styles.tabActive]}
          onPress={() => setActiveTab('terms')}
        >
          <Text style={[styles.tabText, activeTab === 'terms' && styles.tabTextActive]}>
            Terms of Service
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'privacy' && styles.tabActive]}
          onPress={() => setActiveTab('privacy')}
        >
          <Text style={[styles.tabText, activeTab === 'privacy' && styles.tabTextActive]}>
            Privacy Policy
          </Text>
        </TouchableOpacity>
      </View>

      <ContentView content={activeTab === 'terms' ? TERMS_CONTENT : PRIVACY_CONTENT} C={C} />
    </SafeAreaView>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: C.background },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
      borderBottomWidth: 1, borderBottomColor: C.border,
    },
    backBtn: { width: 40, height: 40, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface },
    backText: { fontSize: 20, color: C.text },
    headerTitle: { ...typography.heading, color: C.text },

    tabs: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    tab: {
      flex: 1, paddingVertical: spacing.md, alignItems: 'center',
      borderBottomWidth: 2, borderBottomColor: 'transparent',
    },
    tabActive: { borderBottomColor: C.primary },
    tabText: { ...typography.caption, color: C.textSecondary, fontWeight: '600' },
    tabTextActive: { color: C.primary },
  });
}

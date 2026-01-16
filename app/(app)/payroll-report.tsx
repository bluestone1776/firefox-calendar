import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { format, parse, startOfWeek, endOfWeek, addDays, subDays, getDay } from 'date-fns';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useAuth } from '../../src/hooks/useAuth';
import { listProfiles } from '../../src/data/profiles';
import {
  getAllPayrollConfirmationsForRange,
  getPayrollConfirmationsForRange,
} from '../../src/data/payroll';
import { Profile, PayrollConfirmation } from '../../src/types';
import { Button } from '../../src/components/ui/Button';
import { getTimezone, getDefaultTimezone } from '../../src/utils/timezone';

type ReportRow = {
  profile: Profile;
  date: string;
  hours: number;
  notes?: string;
  confirmedAt?: string;
};

type WeeklySummary = {
  profile: Profile;
  weekStart: string;
  totalHours: number;
  daysConfirmed: number;
  days: ReportRow[];
};

export default function PayrollReportScreen() {
  const router = useRouter();
  const { isAdmin, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => {
    // Default to start of current week (Monday)
    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday
    return weekStart;
  });
  const [endDate, setEndDate] = useState(() => {
    // Default to end of current week (Sunday)
    const today = new Date();
    return endOfWeek(today, { weekStartsOn: 1 });
  });
  const [reportData, setReportData] = useState<ReportRow[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [viewMode, setViewMode] = useState<'daily' | 'weekly'>('daily');
  const [currentTimezone, setCurrentTimezone] = useState<string>(getDefaultTimezone());

  useEffect(() => {
    if (!isAdmin) {
      Alert.alert('Access Denied', 'This screen is only available to administrators.');
      router.back();
      return;
    }
    loadTimezone();
    loadProfiles();
  }, [isAdmin, profile?.timezone]);

  useEffect(() => {
    if (isAdmin && profiles.length > 0) {
      loadReportData();
    }
  }, [startDate, endDate, isAdmin, profiles.length]);

  const loadTimezone = async () => {
    try {
      if (profile?.timezone) {
        setCurrentTimezone(profile.timezone);
        return;
      }
      const tz = await getTimezone();
      setCurrentTimezone(tz);
    } catch (error) {
      console.error('Error loading timezone:', error);
    }
  };

  const loadProfiles = async () => {
    try {
      const data = await listProfiles();
      setProfiles(data);
    } catch (error: any) {
      console.error('Error loading profiles:', error);
      Alert.alert('Error', 'Failed to load profiles');
    }
  };

  const loadReportData = async () => {
    setLoading(true);
    try {
      const startISO = format(startDate, 'yyyy-MM-dd');
      const endISO = format(endDate, 'yyyy-MM-dd');

      const confirmations = await getAllPayrollConfirmationsForRange(startISO, endISO);

      // Group by profile and date
      const rows: ReportRow[] = [];
      confirmations.forEach((conf) => {
        const profile = profiles.find((p) => p.id === conf.profile_id);
        if (profile) {
          rows.push({
            profile,
            date: conf.date,
            hours: conf.confirmed_hours,
            notes: conf.notes,
            confirmedAt: conf.confirmed_at,
          });
        }
      });

      // Sort by date, then by profile email
      rows.sort((a, b) => {
        if (a.date !== b.date) {
          return a.date.localeCompare(b.date);
        }
        return a.profile.email.localeCompare(b.profile.email);
      });

      setReportData(rows);
    } catch (error: any) {
      console.error('Error loading report data:', error);
      Alert.alert('Error', error.message || 'Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  const getWeeklySummaries = (): WeeklySummary[] => {
    const summaries = new Map<string, WeeklySummary>();

    reportData.forEach((row) => {
      const date = parse(row.date, 'yyyy-MM-dd', new Date());
      const weekStart = startOfWeek(date, { weekStartsOn: 1 }); // Monday
      const weekKey = `${row.profile.id}-${format(weekStart, 'yyyy-MM-dd')}`;

      if (!summaries.has(weekKey)) {
        summaries.set(weekKey, {
          profile: row.profile,
          weekStart: format(weekStart, 'yyyy-MM-dd'),
          totalHours: 0,
          daysConfirmed: 0,
          days: [],
        });
      }

      const summary = summaries.get(weekKey)!;
      summary.totalHours += row.hours;
      summary.daysConfirmed += 1;
      summary.days.push(row);
    });

    return Array.from(summaries.values()).sort((a, b) => {
      if (a.weekStart !== b.weekStart) {
        return a.weekStart.localeCompare(b.weekStart);
      }
      return a.profile.email.localeCompare(b.profile.email);
    });
  };

  const generateCSV = (): string => {
    let csv = 'Date,Employee Email,Employee Name,Hours,Notes,Confirmed At\n';

    if (viewMode === 'daily') {
      reportData.forEach((row) => {
        const date = format(parse(row.date, 'yyyy-MM-dd', new Date()), 'yyyy-MM-dd');
        const name = row.profile.name || row.profile.email.split('@')[0];
        const hours = row.hours.toFixed(2);
        const notes = (row.notes || '').replace(/"/g, '""');
        const confirmedAt = row.confirmedAt
          ? format(new Date(row.confirmedAt), 'yyyy-MM-dd HH:mm:ss')
          : '';
        csv += `"${date}","${row.profile.email}","${name}","${hours}","${notes}","${confirmedAt}"\n`;
      });
    } else {
      // Weekly summary
      csv = 'Week Start,Employee Email,Employee Name,Total Hours,Days Confirmed\n';
      getWeeklySummaries().forEach((summary) => {
        const weekStart = format(parse(summary.weekStart, 'yyyy-MM-dd', new Date()), 'yyyy-MM-dd');
        const name = summary.profile.name || summary.profile.email.split('@')[0];
        const totalHours = summary.totalHours.toFixed(2);
        csv += `"${weekStart}","${summary.profile.email}","${name}","${totalHours}","${summary.daysConfirmed}"\n`;
      });
    }

    return csv;
  };

  const handleExportCSV = async () => {
    try {
      const csv = generateCSV();
      const fileName = `payroll-report-${format(startDate, 'yyyy-MM-dd')}-to-${format(endDate, 'yyyy-MM-dd')}.csv`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(fileUri, csv, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export Payroll Report',
        });
      } else {
        Alert.alert('Export Complete', `CSV saved to: ${fileUri}`);
      }
    } catch (error: any) {
      console.error('Error exporting CSV:', error);
      Alert.alert('Error', error.message || 'Failed to export CSV');
    }
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setStartDate(subDays(startDate, 7));
      setEndDate(subDays(endDate, 7));
    } else {
      setStartDate(addDays(startDate, 7));
      setEndDate(addDays(endDate, 7));
    }
  };

  const goToCurrentWeek = () => {
    const today = new Date();
    setStartDate(startOfWeek(today, { weekStartsOn: 1 }));
    setEndDate(endOfWeek(today, { weekStartsOn: 1 }));
  };

  const totalHours = reportData.reduce((sum, row) => sum + row.hours, 0);
  const uniqueEmployees = new Set(reportData.map((row) => row.profile.id)).size;

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'daily' && styles.toggleButtonActive]}
            onPress={() => setViewMode('daily')}
          >
            <Text
              style={[
                styles.toggleButtonText,
                viewMode === 'daily' && styles.toggleButtonTextActive,
              ]}
            >
              Daily
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'weekly' && styles.toggleButtonActive]}
            onPress={() => setViewMode('weekly')}
          >
            <Text
              style={[
                styles.toggleButtonText,
                viewMode === 'weekly' && styles.toggleButtonTextActive,
              ]}
            >
              Weekly
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.dateRange}>
          <View style={styles.dateNavigation}>
            <TouchableOpacity onPress={() => navigateWeek('prev')} style={styles.navButton}>
              <Text style={styles.navButtonText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.dateRangeText}>
              {format(startDate, 'MMM d')} - {format(endDate, 'MMM d, yyyy')}
            </Text>
            <TouchableOpacity onPress={() => navigateWeek('next')} style={styles.navButton}>
              <Text style={styles.navButtonText}>→</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={goToCurrentWeek} style={styles.todayButton}>
            <Text style={styles.todayButtonText}>This Week</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.summary}>
          <Text style={styles.summaryText}>
            {uniqueEmployees} employee{uniqueEmployees !== 1 ? 's' : ''} • {totalHours.toFixed(1)}{' '}
            total hours
          </Text>
        </View>
      </View>

      {viewMode === 'daily' ? (
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.dateCell]}>Date</Text>
            <Text style={[styles.tableHeaderCell, styles.nameCell]}>Employee</Text>
            <Text style={[styles.tableHeaderCell, styles.hoursCell]}>Hours</Text>
          </View>
          {reportData.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No confirmations found for this period</Text>
            </View>
          ) : (
            reportData.map((row, index) => (
              <View key={`${row.profile.id}-${row.date}-${index}`} style={styles.tableRow}>
                <Text style={[styles.tableCell, styles.dateCell]}>
                  {format(parse(row.date, 'yyyy-MM-dd', new Date()), 'MMM d')}
                </Text>
                <Text style={[styles.tableCell, styles.nameCell]} numberOfLines={1}>
                  {row.profile.name || row.profile.email.split('@')[0]}
                </Text>
                <Text style={[styles.tableCell, styles.hoursCell]}>
                  {row.hours.toFixed(1)}h
                </Text>
              </View>
            ))
          )}
        </View>
      ) : (
        <View style={styles.weeklyContainer}>
          {getWeeklySummaries().length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No weekly summaries found for this period</Text>
            </View>
          ) : (
            getWeeklySummaries().map((summary, index) => (
              <View key={`${summary.profile.id}-${summary.weekStart}-${index}`} style={styles.weeklyCard}>
                <View style={styles.weeklyHeader}>
                  <View>
                    <Text style={styles.weeklyEmployee}>
                      {summary.profile.name || summary.profile.email.split('@')[0]}
                    </Text>
                    <Text style={styles.weeklyDate}>
                      Week of {format(parse(summary.weekStart, 'yyyy-MM-dd', new Date()), 'MMM d, yyyy')}
                    </Text>
                  </View>
                  <View style={styles.weeklyStats}>
                    <Text style={styles.weeklyHours}>{summary.totalHours.toFixed(1)}h</Text>
                    <Text style={styles.weeklyDays}>{summary.daysConfirmed} days</Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      )}

      <Button
        title="Export CSV"
        onPress={handleExportCSV}
        style={styles.exportButton}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    padding: 16,
  },
  header: {
    marginBottom: 16,
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  toggleButtonActive: {
    backgroundColor: '#007AFF',
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  toggleButtonTextActive: {
    color: '#FFFFFF',
  },
  dateRange: {
    marginBottom: 12,
  },
  dateNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  navButton: {
    padding: 8,
  },
  navButtonText: {
    fontSize: 18,
    color: '#007AFF',
    fontWeight: '600',
  },
  dateRangeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  todayButton: {
    alignSelf: 'center',
    padding: 8,
  },
  todayButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  summary: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
  },
  summaryText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000000',
  },
  table: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 16,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F8F9FA',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  tableHeaderCell: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  tableCell: {
    fontSize: 14,
    color: '#000000',
  },
  dateCell: {
    flex: 1,
  },
  nameCell: {
    flex: 2,
  },
  hoursCell: {
    flex: 1,
    textAlign: 'right',
    fontWeight: '500',
  },
  weeklyContainer: {
    marginBottom: 16,
  },
  weeklyCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  weeklyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  weeklyEmployee: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  weeklyDate: {
    fontSize: 12,
    color: '#666666',
  },
  weeklyStats: {
    alignItems: 'flex-end',
  },
  weeklyHours: {
    fontSize: 18,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 4,
  },
  weeklyDays: {
    fontSize: 12,
    color: '#666666',
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#999999',
  },
  exportButton: {
    marginTop: 16,
    marginBottom: 32,
  },
});

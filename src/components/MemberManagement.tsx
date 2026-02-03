import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TextInput,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  FlatList,
  Pressable,
} from 'react-native';
import { Profile } from '../types';
import {
  listProfiles,
  updateProfileName,
  updateProfileRole,
  deleteProfile,
} from '../data/profiles';
import { Button } from './ui/Button';

interface MemberManagementProps {
  isAdmin: boolean;
  currentUserId?: string;
}

export function MemberManagement({ isAdmin, currentUserId }: MemberManagementProps) {
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<Profile | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<'admin' | 'staff'>('staff');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    try {
      setLoading(true);
      const profiles = await listProfiles();
      setMembers(profiles);
    } catch (error) {
      console.error('Error loading members:', error);
      Alert.alert('Error', 'Failed to load members');
    } finally {
      setLoading(false);
    }
  };

  const handleEditMember = (member: Profile) => {
    setSelectedMember(member);
    setEditName(member.name || '');
    setEditRole(member.role);
    setEditModalVisible(true);
  };

  const handleSaveChanges = async () => {
    if (!selectedMember) return;

    if (!editName.trim()) {
      Alert.alert('Error', 'Name cannot be empty');
      return;
    }

    try {
      setSaving(true);

      // Update name
      await updateProfileName(selectedMember.id, editName.trim());

      // Update role if admin changed it
      if (isAdmin && editRole !== selectedMember.role) {
        await updateProfileRole(selectedMember.id, editRole);
      }

      // Refresh members list
      await loadMembers();
      setEditModalVisible(false);
      Alert.alert('Success', 'Member updated successfully');
    } catch (error: any) {
      console.error('Error saving changes:', error);
      Alert.alert('Error', error.message || 'Failed to update member');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMember = (member: Profile) => {
    if (member.id === currentUserId) {
      Alert.alert('Error', 'You cannot delete your own account');
      return;
    }

    Alert.alert(
      'Delete Member',
      `Are you sure you want to delete ${member.name || member.email}? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              await deleteProfile(member.id);
              await loadMembers();
              Alert.alert('Success', 'Member deleted successfully');
            } catch (error: any) {
              console.error('Error deleting member:', error);
              Alert.alert('Error', error.message || 'Failed to delete member');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Team Members ({members.length})</Text>

      <FlatList
        data={members}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <View style={styles.memberCard}>
            <View style={styles.memberInfo}>
              <Text style={styles.memberName}>{item.name || item.email}</Text>
              <Text style={styles.memberEmail}>{item.email}</Text>
              <View style={styles.memberMeta}>
                <Text style={[styles.roleBadge, item.role === 'admin' ? styles.adminBadge : styles.staffBadge]}>
                  {item.role.charAt(0).toUpperCase() + item.role.slice(1)}
                </Text>
                {item.id === currentUserId && <Text style={styles.youBadge}>You</Text>}
              </View>
            </View>

            <View style={styles.memberActions}>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => handleEditMember(item)}
              >
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>

              {isAdmin && item.id !== currentUserId && (
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeleteMember(item)}
                >
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      />

      {/* Edit Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setEditModalVisible(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Edit Member</Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                value={editName}
                onChangeText={setEditName}
                placeholder="Enter name"
                editable={!saving}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Email</Text>
              <Text style={styles.emailDisplay}>{selectedMember?.email}</Text>
            </View>

            {isAdmin && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Role</Text>
                <View style={styles.roleSelector}>
                  <TouchableOpacity
                    style={[
                      styles.roleOption,
                      editRole === 'staff' && styles.roleOptionSelected,
                    ]}
                    onPress={() => setEditRole('staff')}
                    disabled={saving}
                  >
                    <Text
                      style={[
                        styles.roleOptionText,
                        editRole === 'staff' && styles.roleOptionTextSelected,
                      ]}
                    >
                      Staff
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.roleOption,
                      editRole === 'admin' && styles.roleOptionSelected,
                    ]}
                    onPress={() => setEditRole('admin')}
                    disabled={saving || selectedMember?.id === currentUserId}
                  >
                    <Text
                      style={[
                        styles.roleOptionText,
                        editRole === 'admin' && styles.roleOptionTextSelected,
                      ]}
                    >
                      Admin
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                onPress={() => setEditModalVisible(false)}
                variant="outline"
                style={styles.cancelButton}
                disabled={saving}
              />
              <Button
                title={saving ? 'Saving...' : 'Save Changes'}
                onPress={handleSaveChanges}
                style={styles.saveButton}
                disabled={saving}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
    color: '#000000',
  },
  memberCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  memberEmail: {
    fontSize: 13,
    color: '#666666',
    marginBottom: 6,
  },
  memberMeta: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  roleBadge: {
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  adminBadge: {
    backgroundColor: '#FEE2E2',
    color: '#DC2626',
  },
  staffBadge: {
    backgroundColor: '#DBEAFE',
    color: '#2563EB',
  },
  youBadge: {
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: '#D1FAE5',
    color: '#059669',
  },
  memberActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#007AFF',
    borderRadius: 6,
  },
  editButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  deleteButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#FF3B30',
    borderRadius: 6,
  },
  deleteButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    maxHeight: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
    color: '#000000',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    color: '#333333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D0D0D0',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#000000',
  },
  emailDisplay: {
    fontSize: 14,
    color: '#666666',
    paddingVertical: 10,
  },
  roleSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  roleOption: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 2,
    borderColor: '#D0D0D0',
    borderRadius: 6,
    alignItems: 'center',
  },
  roleOptionSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#F0F8FF',
  },
  roleOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  roleOptionTextSelected: {
    color: '#007AFF',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
  },
  saveButton: {
    flex: 1,
  },
});

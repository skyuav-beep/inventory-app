import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTestResponse,
  fetchTelegramSettings,
  sendCustomAlert,
  sendTestAlert,
  TelegramSettingsResponse,
  updateTelegramSettings,
} from '../../services/settingsService';
import { fetchPermissionTemplates, createUser, PermissionDefinition, Role, UserListItem } from '../../services/userService';
import { useUsers } from '../../app/hooks/useUsers';
import { Modal } from '../../components/ui/Modal';
import { useAuth } from '../../hooks/useAuth';
import styles from './SettingsPage.module.css';

interface TargetFormState {
  key: string;
  chatId: string;
  label: string;
  enabled: boolean;
}

interface TelegramFormState {
  enabled: boolean;
  botToken: string;
  cooldownMinutes: string;
  quietHours: string;
  targets: TargetFormState[];
}

type FeedbackVariant = 'success' | 'error' | 'info';

interface UserFormState {
  email: string;
  name: string;
  role: Role;
  password: string;
  permissions: PermissionDefinition[];
}

const ROLE_LABELS: Record<Role, string> = {
  admin: '관리자',
  operator: '운영자',
  viewer: '열람자',
};

const RESOURCE_LABELS: Record<string, string> = {
  dashboard: '대시보드',
  products: '제품',
  inbounds: '입고',
  outbounds: '출고',
  returns: '반품',
  settings: '설정',
};

type PermissionTemplates = Record<Role, PermissionDefinition[]>;
const DEFAULT_ROLE: Role = 'operator';

function clonePermissions(
  role: Role,
  templates: PermissionTemplates | null,
  fallbackResources: string[],
): PermissionDefinition[] {
  const template = templates?.[role];
  if (template && template.length > 0) {
    return template.map((item) => ({
      resource: item.resource,
      read: item.read,
      write: item.write,
    }));
  }

  return fallbackResources.map((resource) => ({
    resource,
    read: true,
    write: role === 'admin',
  }));
}

function createDefaultUserForm(
  role: Role,
  templates: PermissionTemplates | null,
  resources: string[],
): UserFormState {
  return {
    email: '',
    name: '',
    role,
    password: '',
    permissions: clonePermissions(role, templates, resources),
  };
}

function generateKey(base: string): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `${base}-${Date.now()}-${random}`;
}

function mapSettingsToForm(settings: TelegramSettingsResponse): TelegramFormState {
  return {
    enabled: settings.enabled,
    botToken: settings.botToken ?? '',
    cooldownMinutes: String(settings.cooldownMinutes ?? ''),
    quietHours: settings.quietHours ?? '22-07',
    targets: (settings.targets ?? []).map<TargetFormState>((target) => ({
      key: target.id ?? generateKey('target'),
      chatId: target.chatId,
      label: target.label ?? '',
      enabled: target.enabled,
    })),
  };
}

function createEmptyTarget(): TargetFormState {
  return {
    key: generateKey('target'),
    chatId: '',
    label: '',
    enabled: true,
  };
}

function formatNextAttempt(decision: AlertTestResponse['decision']): string | null {
  if (!decision.nextAttemptAt) {
    return null;
  }

  const parsed = new Date(decision.nextAttemptAt);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toLocaleString();
}

function buildPolicyFeedback(decision: AlertTestResponse['decision']): string {
  const nextAttempt = formatNextAttempt(decision);

  if (decision.reason === 'quiet_hours') {
    return nextAttempt
      ? `야간 시간대에는 알림이 보류됩니다. ${nextAttempt} 이후 다시 시도됩니다.`
      : '야간 시간대에는 알림이 보류됩니다. 조용 시간 이후 다시 시도해 주세요.';
  }

  if (decision.reason === 'cooldown') {
    return nextAttempt
      ? `쿨다운이 적용 중입니다. ${nextAttempt} 이후 자동 재시도가 가능합니다.`
      : '쿨다운이 적용 중입니다. 잠시 후 다시 시도해 주세요.';
  }

  return '현재 정책으로 인해 알림 전송이 제한되었습니다.';
}

export function SettingsPage() {
  const { hasPermission } = useAuth();
  const [form, setForm] = useState<TelegramFormState>({
    enabled: false,
    botToken: '',
    cooldownMinutes: '60',
    quietHours: '22-07',
    targets: [],
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [testFeedback, setTestFeedback] = useState<{ variant: FeedbackVariant; message: string } | null>(null);
  const [customFeedback, setCustomFeedback] = useState<{ variant: FeedbackVariant; message: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [sendingCustom, setSendingCustom] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [customMessage, setCustomMessage] = useState('');
  const {
    items: users,
    pagination: usersPage,
    loading: usersLoading,
    error: usersError,
    setPage: setUsersPage,
    refresh: refreshUsers,
  } = useUsers();
  const [userSuccess, setUserSuccess] = useState<string | null>(null);
  const [userError, setUserError] = useState<string | null>(null);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userFormSubmitting, setUserFormSubmitting] = useState(false);
  const [userFormError, setUserFormError] = useState<string | null>(null);
  const resourceKeys = useMemo(() => Object.keys(RESOURCE_LABELS), []);
  const [permissionTemplates, setPermissionTemplates] = useState<PermissionTemplates | null>(null);
  const [permissionTemplatesLoading, setPermissionTemplatesLoading] = useState(false);
  const [permissionTemplatesError, setPermissionTemplatesError] = useState<string | null>(null);
  const [userForm, setUserForm] = useState<UserFormState>(() =>
    createDefaultUserForm(DEFAULT_ROLE, null, resourceKeys),
  );
  const canManageUsers = hasPermission('settings', { write: true });
  const totalUserPages = useMemo(() => {
    if (usersPage.size === 0) {
      return 1;
    }
    return Math.max(1, Math.ceil(usersPage.total / usersPage.size));
  }, [usersPage.size, usersPage.total]);

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const settings = await fetchTelegramSettings();
      setForm(mapSettingsToForm(settings));
      setUpdatedAt(settings.updatedAt);
    } catch (error) {
      console.error(error);
      setLoadError('텔레그램 설정을 불러오지 못했습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const handleEnabledChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { checked } = event.target;
    setForm((prev) => ({ ...prev, enabled: checked }));
  };

  const handleBotTokenChange = (event: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, botToken: event.target.value }));
  };

  const handleCooldownChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    if (value === '' || /^\d+$/.test(value)) {
      setForm((prev) => ({ ...prev, cooldownMinutes: value }));
    }
  };

  const handleQuietHoursChange = (event: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, quietHours: event.target.value }));
  };

  const handleTargetChange = (index: number, field: 'chatId' | 'label', value: string) => {
    setForm((prev) => {
      const nextTargets = [...prev.targets];
      nextTargets[index] = { ...nextTargets[index], [field]: value };
      return { ...prev, targets: nextTargets };
    });
  };

  const handleTargetEnabledChange = (index: number, enabled: boolean) => {
    setForm((prev) => {
      const nextTargets = [...prev.targets];
      nextTargets[index] = { ...nextTargets[index], enabled };
      return { ...prev, targets: nextTargets };
    });
  };

  const handleRemoveTarget = (index: number) => {
    setForm((prev) => {
      const nextTargets = prev.targets.filter((_, targetIndex) => targetIndex !== index);
      return { ...prev, targets: nextTargets };
    });
  };

  const handleAddTarget = () => {
    setForm((prev) => ({ ...prev, targets: [...prev.targets, createEmptyTarget()] }));
  };

  const loadPermissionTemplates = useCallback(async () => {
    if (permissionTemplates || permissionTemplatesLoading) {
      return;
    }

    try {
      setPermissionTemplatesLoading(true);
      setPermissionTemplatesError(null);
      const response = await fetchPermissionTemplates();
      setPermissionTemplates(response.data);
      setUserForm((prev) => createDefaultUserForm(prev.role, response.data, resourceKeys));
    } catch (error) {
      console.error(error);
      setPermissionTemplatesError('권한 템플릿을 불러오지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setPermissionTemplatesLoading(false);
    }
  }, [permissionTemplates, permissionTemplatesLoading, resourceKeys]);

  const openUserModal = () => {
    setUserFormError(null);
    setUserError(null);
    setUserSuccess(null);
    setUserForm(createDefaultUserForm(DEFAULT_ROLE, permissionTemplates, resourceKeys));
    setUserModalOpen(true);
  };

  const handleCloseUserModal = () => {
    if (userFormSubmitting) {
      return;
    }
    setUserModalOpen(false);
  };

  useEffect(() => {
    if (userModalOpen) {
      void loadPermissionTemplates();
    }
  }, [userModalOpen, loadPermissionTemplates]);

  const handleUserRoleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextRole = event.target.value as Role;
    setUserForm((prev) => ({
      ...prev,
      role: nextRole,
      permissions: clonePermissions(nextRole, permissionTemplates, resourceKeys),
    }));
  };

  const handlePermissionToggle = (resource: string, field: 'read' | 'write', checked: boolean) => {
    setUserForm((prev) => {
      const nextPermissions = prev.permissions.map((permission) => {
        if (permission.resource !== resource) {
          return permission;
        }

        if (field === 'read') {
          return {
            ...permission,
            read: checked,
            write: checked ? permission.write : false,
          };
        }

        return {
          ...permission,
          write: checked,
          read: checked ? true : permission.read,
        };
      });

      return {
        ...prev,
        permissions: nextPermissions,
      };
    });
  };

  const handleResetPermissionsToTemplate = () => {
    setUserForm((prev) => ({
      ...prev,
      permissions: clonePermissions(prev.role, permissionTemplates, resourceKeys),
    }));
  };

  const sanitizeUserForm = (formState: UserFormState) => {
    return {
      email: formState.email.trim(),
      name: formState.name.trim(),
      password: formState.password,
      role: formState.role,
      permissions: formState.permissions.map((permission) => ({
        resource: permission.resource,
        read: permission.read || permission.write,
        write: permission.write,
      })),
    };
  };

  const handleSubmitUserForm = async (event?: FormEvent<HTMLFormElement>) => {
    if (event) {
      event.preventDefault();
    }

    setUserFormError(null);
    setUserError(null);

    const trimmedEmail = userForm.email.trim();
    const trimmedName = userForm.name.trim();

    if (!trimmedEmail || !trimmedName) {
      setUserFormError('이메일과 이름을 입력해 주세요.');
      return;
    }

    if (userForm.password.length < 8) {
      setUserFormError('비밀번호는 8자 이상이어야 합니다.');
      return;
    }

    try {
      setUserFormSubmitting(true);
      const payload = sanitizeUserForm(userForm);
      await createUser(payload);
      setUserSuccess('새 사용자를 초대했습니다.');
      setUserModalOpen(false);
      setUserForm(createDefaultUserForm(DEFAULT_ROLE, permissionTemplates, resourceKeys));
      refreshUsers();
    } catch (error) {
      console.error(error);
      setUserFormError('사용자 생성 중 오류가 발생했습니다. 입력값을 확인한 뒤 다시 시도해 주세요.');
    } finally {
      setUserFormSubmitting(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setSaveError(null);
    setSaveSuccess(null);
    setTestFeedback(null);
    setCustomFeedback(null);

    const cooldown = Number.parseInt(form.cooldownMinutes, 10);
    if (Number.isNaN(cooldown) || cooldown < 1 || cooldown > 1440) {
      setSaveError('쿨다운 시간은 1분 이상 1440분 이하의 숫자로 입력해주세요.');
      return;
    }

    const quietHours = form.quietHours.trim();
    if (!/^[0-2]\d-[0-2]\d$/.test(quietHours)) {
      setSaveError('야간 시간대는 HH-HH 형식으로 입력해주세요. 예: 22-07');
      return;
    }

    const normalizedTargets = form.targets
      .map((target) => ({
        chatId: target.chatId.trim(),
        label: target.label.trim() ? target.label.trim() : undefined,
        enabled: target.enabled,
      }))
      .filter((target) => target.chatId.length > 0);

    setSaving(true);

    try {
      const response = await updateTelegramSettings({
        enabled: form.enabled,
        botToken: form.botToken.trim() === '' ? undefined : form.botToken.trim(),
        cooldownMinutes: cooldown,
        quietHours,
        targets: normalizedTargets,
      });

      setForm(mapSettingsToForm(response));
      setUpdatedAt(response.updatedAt);
      setSaveSuccess('텔레그램 설정을 저장했습니다.');
    } catch (error) {
      console.error(error);
      setSaveError('설정을 저장하지 못했습니다. 입력값을 확인한 뒤 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  const handleTestAlert = async () => {
    setTestFeedback(null);
    setTesting(true);

    try {
      const response = await sendTestAlert();

      if (response.success) {
        setTestFeedback({
          variant: 'success',
          message: '텔레그램 테스트 알림을 발송했습니다. 대상 Chat ID를 확인하세요.',
        });
        return;
      }

      setTestFeedback({
        variant: 'info',
        message: buildPolicyFeedback(response.decision),
      });
    } catch (error) {
      console.error(error);
      setTestFeedback({
        variant: 'error',
        message: '테스트 알림을 요청하지 못했습니다. 봇 토큰과 네트워크 상태를 확인하세요.',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSendCustom = async () => {
    setCustomFeedback(null);
    const trimmed = customMessage.trim();

    if (trimmed.length === 0) {
      setCustomFeedback({ variant: 'error', message: '보낼 메시지를 입력해주세요.' });
      return;
    }

    setSendingCustom(true);

    try {
      const response = await sendCustomAlert(trimmed);
      if (response.success) {
        setCustomFeedback({
          variant: 'success',
          message: '텔레그램으로 메시지를 발송했습니다.',
        });
        setCustomMessage('');
      } else {
        setCustomFeedback({
          variant: 'info',
          message: buildPolicyFeedback(response.decision),
        });
      }
    } catch (error) {
      console.error(error);
      setCustomFeedback({
        variant: 'error',
        message: '메시지를 전송하지 못했습니다. 설정을 확인한 뒤 다시 시도해 주세요.',
      });
    } finally {
      setSendingCustom(false);
    }
  };

  const renderFeedback = (message: string, variant: FeedbackVariant) => {
    const className =
      variant === 'success'
        ? `${styles.feedback} ${styles.feedbackSuccess}`
        : variant === 'error'
          ? `${styles.feedback} ${styles.feedbackError}`
          : `${styles.feedback} ${styles.feedbackInfo}`;

    return <div className={className}>{message}</div>;
  };

  return (
    <div className={styles.container}>
      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <div>
            <h3>텔레그램 알림 설정</h3>
            <p>안전재고 부족 알림을 받을 채널과 대상을 관리합니다.</p>
          </div>
          {updatedAt && <span className={styles.metaText}>마지막 업데이트: {new Date(updatedAt).toLocaleString()}</span>}
        </header>

        {loadError && (
          <div className={`${styles.feedback} ${styles.feedbackError}`}>
            <div>{loadError}</div>
            <button type="button" className={styles.secondaryButton} onClick={() => void loadSettings()}>
              다시 불러오기
            </button>
          </div>
        )}

        {saveError && renderFeedback(saveError, 'error')}
        {saveSuccess && renderFeedback(saveSuccess, 'success')}
        {testFeedback && renderFeedback(testFeedback.message, testFeedback.variant)}
        {customFeedback && renderFeedback(customFeedback.message, customFeedback.variant)}

        {loading ? (
          <div className={styles.loading}>설정을 불러오는 중입니다...</div>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.toggleRow}>
              <label className={styles.toggleControl}>
                <input type="checkbox" checked={form.enabled} onChange={handleEnabledChange} />
                <span>텔레그램 알림 사용</span>
              </label>
              <span className={styles.helpText}>봇 토큰과 대상 Chat ID가 있어야 메시지가 발송됩니다.</span>
            </div>

            <div className={styles.formGrid}>
              <div className={styles.fieldGroup}>
                <label htmlFor="bot-token">봇 토큰</label>
                <input
                  id="bot-token"
                  type="password"
                  placeholder="1234567:ABC-DEF..."
                  value={form.botToken}
                  onChange={handleBotTokenChange}
                  autoComplete="off"
                />
                <p className={styles.helpText}>새 토큰으로 교체하지 않으려면 비워두세요.</p>
              </div>

              <div className={styles.fieldGroup}>
                <label htmlFor="cooldown-minutes">쿨다운(분)</label>
                <input
                  id="cooldown-minutes"
                  type="text"
                  inputMode="numeric"
                  min={1}
                  max={1440}
                  value={form.cooldownMinutes}
                  onChange={handleCooldownChange}
                />
                <p className={styles.helpText}>동일 제품 알림 간 최소 간격을 분 단위로 설정합니다.</p>
              </div>

              <div className={styles.fieldGroup}>
                <label htmlFor="quiet-hours">야간 시간대 (HH-HH)</label>
                <input
                  id="quiet-hours"
                  type="text"
                  placeholder="22-07"
                  value={form.quietHours}
                  onChange={handleQuietHoursChange}
                />
                <p className={styles.helpText}>예: 22-07 입력 시 22시부터 다음날 07시까지 알림이 보류됩니다.</p>
              </div>
            </div>

            <div className={styles.targetsBlock}>
              <div className={styles.targetsHeader}>
                <div>
                  <h4>알림 대상</h4>
                  <p className={styles.helpText}>텔레그램 Chat ID는 `/start` 이후 봇 대화에서 `/chatid` 등으로 확인하세요.</p>
                </div>
                <button type="button" className={styles.secondaryButton} onClick={handleAddTarget}>
                  대상 추가
                </button>
              </div>

              <div className={styles.targetsTableWrapper}>
                {form.targets.length === 0 ? (
                  <div className={styles.emptyTargets}>등록된 대상이 없습니다. 대상 추가를 눌러 첫 Chat ID를 등록하세요.</div>
                ) : (
                  <table className={styles.targetsTable}>
                    <thead>
                      <tr>
                        <th>Chat ID</th>
                        <th>라벨</th>
                        <th>활성화</th>
                        <th>삭제</th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.targets.map((target, index) => (
                        <tr key={target.key}>
                          <td>
                            <input
                              type="text"
                              value={target.chatId}
                              onChange={(event) => handleTargetChange(index, 'chatId', event.target.value)}
                              placeholder="@channel 또는 숫자 ID"
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              value={target.label}
                              onChange={(event) => handleTargetChange(index, 'label', event.target.value)}
                              placeholder="예: 야간조 채널"
                            />
                          </td>
                          <td>
                            <label className={styles.checkboxCell}>
                              <input
                                type="checkbox"
                                checked={target.enabled}
                                onChange={(event) => handleTargetEnabledChange(index, event.target.checked)}
                              />
                              활성
                            </label>
                          </td>
                          <td>
                            <button
                              type="button"
                              className={styles.removeButton}
                              onClick={() => handleRemoveTarget(index)}
                              aria-label="대상 삭제"
                            >
                              삭제
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className={styles.buttonRow}>
              <button type="submit" className={styles.primaryButton} disabled={saving}>
                {saving ? '저장 중...' : '변경사항 저장'}
              </button>
              <button type="button" className={styles.secondaryButton} onClick={handleTestAlert} disabled={testing || loading}>
                {testing ? '테스트 발송 중...' : '텔레그램 테스트 발송'}
              </button>
            </div>

            <div className={styles.customMessageBlock}>
              <div className={styles.targetsHeader}>
                <div>
                  <h4>메시지 작성 후 즉시 발송</h4>
                  <p className={styles.helpText}>
                    저장된 텔레그램 대상에게 임시 공지를 보낼 수 있습니다. 메시지는 즉시 발송되며 기록에 남습니다.
                  </p>
                </div>
              </div>

              <textarea
                className={styles.messageTextarea}
                placeholder="예: 안녕하세요 르메뜨리"
                value={customMessage}
                onChange={(event) => setCustomMessage(event.target.value)}
                maxLength={1000}
                rows={4}
              />

              <div className={styles.buttonRow}>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={handleSendCustom}
                  disabled={sendingCustom || loading}
                >
                  {sendingCustom ? '발송 중...' : '메시지 발송'}
                </button>
              </div>
            </div>
          </form>
        )}
      </section>

      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <div>
            <h3>사용자 & 권한</h3>
            <p>역할별 기본 권한을 기반으로 사용자 접근 범위를 관리할 수 있습니다.</p>
          </div>
          {canManageUsers && (
            <div className={styles.buttonRow}>
              <button type="button" className={styles.primaryButton} onClick={openUserModal}>
                사용자 초대
              </button>
            </div>
          )}
        </header>

        {userSuccess && <div className={`${styles.feedback} ${styles.feedbackSuccess}`}>{userSuccess}</div>}
        {(userError || usersError) && (
          <div className={`${styles.feedback} ${styles.feedbackError}`}>{userError ?? usersError}</div>
        )}

        <div className={styles.usersTableWrapper}>
          {usersLoading ? (
            <div className={styles.loadingRow}>사용자 정보를 불러오는 중입니다...</div>
          ) : users.length === 0 ? (
            <div className={styles.emptyUsers}>등록된 사용자가 없습니다.</div>
          ) : (
            <table className={styles.usersTable}>
              <thead>
                <tr>
                  <th>이름</th>
                  <th>이메일</th>
                  <th>역할</th>
                  <th>읽기 권한</th>
                  <th>쓰기 권한</th>
                </tr>
              </thead>
              <tbody>
                {users.map((userItem: UserListItem) => {
                  const readable = userItem.permissions.filter((permission) => permission.read);
                  const writable = userItem.permissions.filter((permission) => permission.write);
                  return (
                    <tr key={userItem.id}>
                      <td>
                        <div className={styles.userNameCell}>
                          <span className={styles.userName}>{userItem.name}</span>
                          <span className={styles.userRoleBadge}>{ROLE_LABELS[userItem.role] ?? userItem.role}</span>
                        </div>
                      </td>
                      <td>{userItem.email}</td>
                      <td>{ROLE_LABELS[userItem.role] ?? userItem.role}</td>
                      <td>
                        <div className={styles.permissionChips}>
                          {readable.length === 0
                            ? '-'
                            : readable.map((permission) => (
                                <span key={`${userItem.id}-read-${permission.resource}`} className={styles.chip}>
                                  {RESOURCE_LABELS[permission.resource] ?? permission.resource}
                                </span>
                              ))}
                        </div>
                      </td>
                      <td>
                        <div className={styles.permissionChips}>
                          {writable.length === 0
                            ? '-'
                            : writable.map((permission) => (
                                <span key={`${userItem.id}-write-${permission.resource}`} className={styles.chipAccent}>
                                  {RESOURCE_LABELS[permission.resource] ?? permission.resource}
                                </span>
                              ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {users.length > 0 && (
          <div className={styles.paginationRow}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => setUsersPage(usersPage.page - 1)}
              disabled={usersPage.page <= 1 || usersLoading}
            >
              이전
            </button>
            <span className={styles.paginationMeta}>
              페이지 {usersPage.page} / {totalUserPages}
            </span>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => setUsersPage(usersPage.page + 1)}
              disabled={usersPage.page >= totalUserPages || usersLoading}
            >
              다음
            </button>
          </div>
        )}
      </section>

      <Modal
        open={userModalOpen}
        onClose={handleCloseUserModal}
        title="새 사용자 초대"
        size="lg"
        footer={
          <>
            <button type="button" className={styles.secondaryButton} onClick={handleCloseUserModal} disabled={userFormSubmitting}>
              취소
            </button>
            <button type="submit" form="user-create-form" className={styles.primaryButton} disabled={userFormSubmitting}>
              {userFormSubmitting ? '생성 중...' : '사용자 생성'}
            </button>
          </>
        }
      >
        <form id="user-create-form" className={styles.userForm} onSubmit={handleSubmitUserForm}>
          <div className={styles.modalGrid}>
            <div className={styles.modalField}>
              <label htmlFor="user-email">이메일</label>
              <input
                id="user-email"
                type="email"
                value={userForm.email}
                onChange={(event) => setUserForm((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="user@example.com"
                required
              />
            </div>
            <div className={styles.modalField}>
              <label htmlFor="user-name">이름</label>
              <input
                id="user-name"
                type="text"
                value={userForm.name}
                onChange={(event) => setUserForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="홍길동"
                required
              />
            </div>
            <div className={styles.modalField}>
              <label htmlFor="user-role">역할</label>
              <select id="user-role" value={userForm.role} onChange={handleUserRoleChange}>
                <option value="admin">관리자</option>
                <option value="operator">운영자</option>
                <option value="viewer">열람자</option>
              </select>
            </div>
            <div className={styles.modalField}>
              <label htmlFor="user-password">임시 비밀번호</label>
              <input
                id="user-password"
                type="password"
                value={userForm.password}
                onChange={(event) => setUserForm((prev) => ({ ...prev, password: event.target.value }))}
                placeholder="최소 8자, 영문/숫자 혼합"
                minLength={8}
                required
              />
            </div>
          </div>

          <div className={styles.permissionsHeader}>
            <div>
              <h4>세부 권한 설정</h4>
              <p className={styles.helpText}>역할 템플릿을 기반으로 필요 시 읽기/쓰기 권한을 조정하세요.</p>
            </div>
            <div className={styles.buttonRow}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={handleResetPermissionsToTemplate}
                disabled={permissionTemplatesLoading}
              >
                역할 템플릿으로 초기화
              </button>
            </div>
          </div>

          {permissionTemplatesError && (
            <div className={`${styles.feedback} ${styles.feedbackError}`}>{permissionTemplatesError}</div>
          )}

          <div className={styles.permissionTableWrapper}>
            <table className={styles.permissionTable}>
              <thead>
                <tr>
                  <th>리소스</th>
                  <th>읽기</th>
                  <th>쓰기</th>
                </tr>
              </thead>
              <tbody>
                {userForm.permissions.map((permission) => (
                  <tr key={permission.resource}>
                    <td>{RESOURCE_LABELS[permission.resource] ?? permission.resource}</td>
                    <td>
                      <label className={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          checked={permission.read}
                          onChange={(event) =>
                            handlePermissionToggle(permission.resource, 'read', event.target.checked)
                          }
                        />
                        읽기 허용
                      </label>
                    </td>
                    <td>
                      <label className={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          checked={permission.write}
                          onChange={(event) =>
                            handlePermissionToggle(permission.resource, 'write', event.target.checked)
                          }
                        />
                        쓰기 허용
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {userFormError && <p className={styles.errorText}>{userFormError}</p>}
        </form>
      </Modal>
    </div>
  );
}

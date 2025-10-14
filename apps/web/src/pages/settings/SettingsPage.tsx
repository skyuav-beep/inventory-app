import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from 'react';
import {
  AlertTestResponse,
  fetchTelegramSettings,
  sendCustomAlert,
  sendTestAlert,
  TelegramSettingsResponse,
  updateTelegramSettings,
} from '../../services/settingsService';
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
            <p>역할 기반 접근제어(RBAC) 화면은 다음 스프린트에서 연결될 예정입니다.</p>
          </div>
        </header>

        <div className={styles.placeholderCard}>
          <p>
            현재는 관리자 권한으로만 접근이 가능합니다. 곧 사용자 목록과 권한 템플릿을 설정할 수 있는 UI가 추가될 예정입니다.
          </p>
          <div className={styles.placeholderActions}>
            <button type="button" className={styles.secondaryButton}>
              권한 정책 문서 보기
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

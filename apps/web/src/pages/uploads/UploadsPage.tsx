import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  uploadStockFile,
  UploadKind,
  fetchUploadJobs,
  fetchUploadJobItems,
  UploadJob,
  UploadJobItem,
  UploadStatus,
} from '../../services/uploadService';
import { downloadCsvTemplate } from '../../lib/downloadTemplate';
import styles from './UploadsPage.module.css';

type UploadState = 'idle' | 'uploading' | 'success' | 'error';

interface UploadResult {
  id: string;
  type: UploadKind;
  filename: string;
  originalName: string;
  createdAt: string;
  message: string;
}

const instructions: Array<{ title: string; description: string }> = [
  {
    title: 'Excel/CSV 템플릿을 사용하세요',
    description: '템플릿 컬럼 순서를 유지하고 UTF-8 인코딩으로 저장해야 합니다.',
  },
  {
    title: '수량은 숫자만 입력',
    description: '입/출고 수량은 1 이상의 정수여야 하며, 데시멀은 지원하지 않습니다.',
  },
  {
    title: '업로드 후 결과 확인',
    description: '작업이 완료되면 결과 리포트를 제공할 예정입니다.',
  },
];

export function UploadsPage() {
  const [selectedType, setSelectedType] = useState<UploadKind>('inbound');
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<UploadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);

  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [jobPage, setJobPage] = useState({ page: 1, size: 10, total: 0 });

  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [jobItems, setJobItems] = useState<UploadJobItem[]>([]);
  const [jobItemsLoading, setJobItemsLoading] = useState(false);
  const [jobItemsError, setJobItemsError] = useState<string | null>(null);
  const [jobItemsPage, setJobItemsPage] = useState({ page: 1, size: 10, total: 0 });

  const isSubmitDisabled = useMemo(() => state === 'uploading' || !file, [file, state]);

  const loadJobs = useCallback(
    async (page = 1) => {
      try {
        setJobsLoading(true);
        setJobsError(null);
        const response = await fetchUploadJobs({ page, size: 10 });
        setJobs(response.data);
        setJobPage(response.page);
      } catch (err) {
        console.error(err);
        setJobsError(err instanceof Error ? err.message : '업로드 내역을 불러오지 못했습니다.');
      } finally {
        setJobsLoading(false);
      }
    },
    [],
  );

  const loadJobItems = useCallback(
    async (jobId: string, page = 1) => {
      try {
        setJobItemsLoading(true);
        setJobItemsError(null);
        const response = await fetchUploadJobItems(jobId, { page, size: 10 });
        setJobItems(response.data);
        setJobItemsPage(response.page);
        setSelectedJobId(jobId);
      } catch (err) {
        console.error(err);
        setJobItemsError(err instanceof Error ? err.message : '업로드 상세 내역을 불러오지 못했습니다.');
      } finally {
        setJobItemsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  const handleTypeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedType(event.target.value as UploadKind);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    setFile(nextFile);
    setResult(null);
    setError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) {
      setError('업로드할 파일을 선택해 주세요.');
      return;
    }

    setState('uploading');
    setError(null);
    setResult(null);

    try {
      const response = await uploadStockFile(selectedType, file);
      setResult({
        id: response.job.id,
        type: response.job.type,
        filename: response.job.filename,
        originalName: response.job.originalName,
        createdAt: response.job.createdAt,
        message: response.message,
      });
      setState('success');
      void loadJobs();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : '업로드 중 오류가 발생했습니다.');
      setState('error');
    }
  };

  const handleRefreshJobs = () => {
    void loadJobs();
  };

  const handleSelectJob = (jobId: string) => {
    void loadJobItems(jobId);
  };

  const handleDownloadInboundTemplate = () => {
    const today = new Date().toISOString().slice(0, 10);
    downloadCsvTemplate('inbounds-template.csv', ['code', 'quantity', 'date', 'note'], [
      ['SKU-0001', '10', today, '입고 메모'],
    ]);
  };

  const handleDownloadOutboundTemplate = () => {
    const today = new Date().toISOString().slice(0, 10);
    downloadCsvTemplate('outbounds-template.csv', ['code', 'quantity', 'date', 'note'], [
      ['SKU-0002', '5', today, '출고 메모'],
    ]);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h3>재고 업로드</h3>
          <p>입/출고 데이터를 Excel 또는 CSV로 업로드하여 대량 등록하세요.</p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.secondaryButton} onClick={handleDownloadInboundTemplate}>
            입고 템플릿 다운로드
          </button>
          <button type="button" className={styles.secondaryButton} onClick={handleDownloadOutboundTemplate}>
            출고 템플릿 다운로드
          </button>
        </div>
      </header>

      <section className={styles.contentGrid}>
        <form className={styles.uploadPanel} onSubmit={handleSubmit}>
          <div className={styles.fieldGroup}>
            <label htmlFor="upload-type">업로드 유형</label>
            <select id="upload-type" value={selectedType} onChange={handleTypeChange}>
              <option value="inbound">입고 업로드</option>
              <option value="outbound">출고 업로드</option>
            </select>
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="file-input">파일 선택</label>
            <input id="file-input" type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} />
            {file && (
              <p className={styles.fileInfo}>
                선택된 파일: <strong>{file.name}</strong>
              </p>
            )}
          </div>

          <button type="submit" className={styles.primaryButton} disabled={isSubmitDisabled}>
            {state === 'uploading' ? '업로드 중...' : '업로드 실행'}
          </button>

          {error && <p className={styles.errorText}>{error}</p>}
          {state === 'success' && result && (
            <div className={styles.resultCard}>
              <h4>업로드가 큐에 등록되었습니다</h4>
              <dl>
                <div>
                  <dt>작업 ID</dt>
                  <dd>{result.id}</dd>
                </div>
                <div>
                  <dt>원본 파일</dt>
                  <dd>{result.originalName}</dd>
                </div>
                <div>
                  <dt>등록 시각</dt>
                  <dd>{new Date(result.createdAt).toLocaleString()}</dd>
                </div>
              </dl>
              <p>{result.message}</p>
            </div>
          )}
        </form>

        <aside className={styles.guidePanel}>
          <h4>업로드 가이드</h4>
          <ul>
            {instructions.map((item) => (
              <li key={item.title}>
                <strong>{item.title}</strong>
                <span>{item.description}</span>
              </li>
            ))}
          </ul>
        </aside>
      </section>

      <section className={styles.jobsPanel}>
        <header className={styles.panelHeader}>
          <div>
            <h4>업로드 작업 내역</h4>
            <p>최근 업로드한 작업의 상태를 확인하세요.</p>
          </div>
          <button type="button" className={styles.secondaryButton} onClick={handleRefreshJobs}>
            새로고침
          </button>
        </header>

        {jobsError && <p className={styles.errorText}>{jobsError}</p>}

        <div className={styles.tableWrapper}>
          <table>
            <thead>
              <tr>
                <th>등록 시각</th>
                <th>유형</th>
                <th>상태</th>
                <th>처리 건수</th>
                <th>메시지</th>
                <th>액션</th>
              </tr>
            </thead>
            <tbody>
              {jobsLoading ? (
                <tr>
                  <td colSpan={6} className={styles.emptyRow}>
                    업로드 작업을 불러오는 중입니다...
                  </td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className={styles.emptyRow}>
                    등록된 업로드 작업이 없습니다.
                  </td>
                </tr>
              ) : (
                jobs.map((job) => {
                  const counts = job.itemCounts;
                  const totalLabel = counts ? `${counts.completed}/${counts.total}` : '-';

                  return (
                    <tr key={job.id}>
                      <td>{new Date(job.createdAt).toLocaleString()}</td>
                      <td>{job.type === 'inbound' ? '입고' : '출고'}</td>
                      <td>
                        <span className={`${styles.statusTag} ${styles[`status-${job.status}`]}`}>
                          {statusLabel(job.status)}
                        </span>
                      </td>
                      <td>{totalLabel}</td>
                      <td>{job.lastError ?? '-'}</td>
                      <td>
                        <button
                          type="button"
                          className={styles.linkButton}
                          onClick={() => handleSelectJob(job.id)}
                        >
                          상세 보기
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {jobs.length > 0 && (
          <div className={styles.paginationMeta}>
            <span>
              페이지 {jobPage.page} / {Math.max(1, Math.ceil(jobPage.total / jobPage.size))}
            </span>
          </div>
        )}
      </section>

      {selectedJobId && (
        <section className={styles.itemsPanel}>
          <header className={styles.panelHeader}>
            <div>
              <h4>작업 상세 ({selectedJobId})</h4>
              <p>각 행의 처리 결과를 확인할 수 있습니다.</p>
            </div>
          </header>

          {jobItemsError && <p className={styles.errorText}>{jobItemsError}</p>}

          <div className={styles.tableWrapper}>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>제품 코드</th>
                  <th>수량</th>
                  <th>상태</th>
                  <th>비고</th>
                </tr>
              </thead>
              <tbody>
                {jobItemsLoading ? (
                  <tr>
                    <td colSpan={5} className={styles.emptyRow}>
                      행 정보를 불러오는 중입니다...
                    </td>
                  </tr>
                ) : jobItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={styles.emptyRow}>
                      업로드 행 정보가 없습니다.
                    </td>
                  </tr>
                ) : (
                  jobItems.map((item) => {
                    const payload = item.payload;
                    const note = typeof payload.note === 'string' ? payload.note : undefined;
                    const code = typeof payload.code === 'string' ? payload.code : '-';
                    const quantity = typeof payload.quantity === 'number' ? payload.quantity : Number(payload.quantity ?? 0);

                    return (
                      <tr key={item.id}>
                        <td>{item.rowNo}</td>
                        <td>{code}</td>
                        <td>{Number.isFinite(quantity) ? quantity : '-'}</td>
                        <td>
                          <span className={`${styles.statusTag} ${styles[`status-${item.status}`]}`}>
                            {statusLabel(item.status)}
                          </span>
                        </td>
                        <td>{item.errorMessage ?? note ?? '-'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {jobItems.length > 0 && (
            <div className={styles.paginationMeta}>
              <span>
                페이지 {jobItemsPage.page} / {Math.max(1, Math.ceil(jobItemsPage.total / jobItemsPage.size))}
              </span>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function statusLabel(status: UploadStatus): string {
  switch (status) {
    case 'queued':
      return '대기';
    case 'processing':
      return '처리 중';
    case 'completed':
      return '완료';
    case 'failed':
      return '실패';
    default:
      return status;
  }
}

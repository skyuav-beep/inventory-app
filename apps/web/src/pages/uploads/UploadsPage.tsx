import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchUploadJobs,
  fetchUploadJobItems,
  UploadJob,
  UploadJobItem,
  UploadStatus,
} from '../../services/uploadService';
import styles from './UploadsPage.module.css';

export function UploadsPage() {
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [jobPage, setJobPage] = useState({ page: 1, size: 10, total: 0 });

  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [jobItems, setJobItems] = useState<UploadJobItem[]>([]);
  const [jobItemsLoading, setJobItemsLoading] = useState(false);
  const [jobItemsError, setJobItemsError] = useState<string | null>(null);
  const [jobItemsPage, setJobItemsPage] = useState({ page: 1, size: 10, total: 0 });

  const loadJobs = useCallback(
    async (page = 1) => {
      try {
        setJobsLoading(true);
        setJobsError(null);
        const response = await fetchUploadJobs({ page, size: jobPage.size });
        setJobs(response.data);
        setJobPage(response.page);
      } catch (err) {
        console.error(err);
        setJobsError(err instanceof Error ? err.message : '업로드 내역을 불러오지 못했습니다.');
      } finally {
        setJobsLoading(false);
      }
    },
    [jobPage.size],
  );

  const loadJobItems = useCallback(
    async (jobId: string, page = 1) => {
      try {
        setJobItemsLoading(true);
        setJobItemsError(null);
        const response = await fetchUploadJobItems(jobId, { page, size: jobItemsPage.size });
        setJobItems(response.data);
        setJobItemsPage(response.page);
        setSelectedJobId(jobId);
      } catch (err) {
        console.error(err);
        setJobItemsError(
          err instanceof Error ? err.message : '업로드 상세 내역을 불러오지 못했습니다.',
        );
      } finally {
        setJobItemsLoading(false);
      }
    },
    [jobItemsPage.size],
  );

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  const totalJobPages = useMemo(() => {
    if (jobPage.size === 0) {
      return 1;
    }
    return Math.max(1, Math.ceil(jobPage.total / jobPage.size));
  }, [jobPage]);

  const totalJobItemPages = useMemo(() => {
    if (jobItemsPage.size === 0) {
      return 1;
    }
    return Math.max(1, Math.ceil(jobItemsPage.total / jobItemsPage.size));
  }, [jobItemsPage]);

  const handleRefreshJobs = () => {
    void loadJobs(jobPage.page);
  };

  const handleJobPageChange = (page: number) => {
    if (page < 1 || page > totalJobPages) {
      return;
    }
    void loadJobs(page);
  };

  const handleJobItemsPageChange = (page: number) => {
    if (!selectedJobId) {
      return;
    }
    if (page < 1 || page > totalJobItemPages) {
      return;
    }
    void loadJobItems(selectedJobId, page);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h3>업로드 내역</h3>
          <p>입/출고 대량 업로드 작업의 처리 현황을 확인하세요.</p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.secondaryButton} onClick={handleRefreshJobs}>
            새로고침
          </button>
        </div>
      </header>

      <section className={styles.jobsPanel}>
        <header className={styles.panelHeader}>
          <div>
            <h4>업로드 작업 목록</h4>
            <p>최근 실행된 작업들의 상태를 보여줍니다.</p>
          </div>
        </header>

        {jobsError && <p className={styles.errorText}>{jobsError}</p>}

        <div className={styles.tableWrapper}>
          <table>
            <thead>
              <tr>
                <th>작업 ID</th>
                <th>유형</th>
                <th>상태</th>
                <th>등록 시각</th>
                <th>파일명</th>
                <th>메시지</th>
                <th>액션</th>
              </tr>
            </thead>
            <tbody>
              {jobsLoading ? (
                <tr>
                  <td colSpan={7} className={styles.emptyRow}>
                    업로드 작업을 불러오는 중입니다...
                  </td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className={styles.emptyRow}>
                    등록된 업로드 작업이 없습니다.
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id}>
                    <td>
                      <button
                        type="button"
                        className={styles.linkButton}
                        onClick={() => loadJobItems(job.id, 1)}
                      >
                        {job.id}
                      </button>
                    </td>
                    <td>{job.type === 'inbound' ? '입고' : '출고'}</td>
                    <td>
                      <span className={`${styles.statusBadge} ${styles[`status-${job.status}`]}`}>
                        {statusLabel(job.status)}
                      </span>
                    </td>
                    <td>{new Date(job.createdAt).toLocaleString()}</td>
                    <td>{job.originalName}</td>
                    <td>{job.lastError ?? '-'}</td>
                    <td>
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={() => loadJobItems(job.id, 1)}
                      >
                        상세 보기
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className={styles.pagination}>
          <button
            type="button"
            onClick={() => handleJobPageChange(jobPage.page - 1)}
            disabled={jobPage.page <= 1}
          >
            이전
          </button>
          <span>
            {jobPage.page} / {totalJobPages}
          </span>
          <button
            type="button"
            onClick={() => handleJobPageChange(jobPage.page + 1)}
            disabled={jobPage.page >= totalJobPages}
          >
            다음
          </button>
        </div>
      </section>

      {selectedJobId && (
        <section className={styles.itemsPanel}>
          <header className={styles.panelHeader}>
            <div>
              <h4>작업 상세 내역</h4>
              <p>선택한 작업의 처리 결과입니다.</p>
            </div>
          </header>

          {jobItemsError && <p className={styles.errorText}>{jobItemsError}</p>}

          <div className={styles.tableWrapper}>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>상태</th>
                  <th>메시지</th>
                  <th>페이로드</th>
                  <th>등록 시각</th>
                </tr>
              </thead>
              <tbody>
                {jobItemsLoading ? (
                  <tr>
                    <td colSpan={5} className={styles.emptyRow}>
                      상세 내역을 불러오는 중입니다...
                    </td>
                  </tr>
                ) : jobItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={styles.emptyRow}>
                      상세 내역이 없습니다.
                    </td>
                  </tr>
                ) : (
                  jobItems.map((item) => (
                    <tr key={item.id}>
                      <td>{item.id}</td>
                      <td>
                        <span
                          className={`${styles.statusBadge} ${styles[`status-${item.status}`]}`}
                        >
                          {statusLabel(item.status)}
                        </span>
                      </td>
                      <td>{item.errorMessage ?? '-'}</td>
                      <td>
                        <pre className={styles.payloadPreview}>
                          {JSON.stringify(item.payload, null, 2)}
                        </pre>
                      </td>
                      <td>{new Date(item.createdAt).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className={styles.pagination}>
            <button
              type="button"
              onClick={() => handleJobItemsPageChange(jobItemsPage.page - 1)}
              disabled={jobItemsPage.page <= 1}
            >
              이전
            </button>
            <span>
              {jobItemsPage.page} / {totalJobItemPages}
            </span>
            <button
              type="button"
              onClick={() => handleJobItemsPageChange(jobItemsPage.page + 1)}
              disabled={jobItemsPage.page >= totalJobItemPages}
            >
              다음
            </button>
          </div>
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

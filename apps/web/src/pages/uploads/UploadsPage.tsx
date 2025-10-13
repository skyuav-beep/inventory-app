import { ChangeEvent, FormEvent, useMemo, useState } from 'react';
import { uploadStockFile, UploadKind } from '../../services/uploadService';
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

  const isSubmitDisabled = useMemo(() => state === 'uploading' || !file, [file, state]);

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
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : '업로드 중 오류가 발생했습니다.');
      setState('error');
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h3>재고 업로드</h3>
          <p>입/출고 데이터를 Excel 또는 CSV로 업로드하여 대량 등록하세요.</p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.secondaryButton}>
            입고 템플릿 다운로드
          </button>
          <button type="button" className={styles.secondaryButton}>
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
    </div>
  );
}


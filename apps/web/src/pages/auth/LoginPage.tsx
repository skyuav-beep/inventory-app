import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { fetchCurrentUser, login as loginRequest } from '../../services/authService';
import styles from './LoginPage.module.css';

export function LoginPage() {
  const navigate = useNavigate();
  const { login, setUser } = useAuth();
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('ChangeMe123!');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    try {
      setLoading(true);
      const response = await loginRequest({ email, password });
      login(response.accessToken);

      try {
        const currentUser = await fetchCurrentUser();
        setUser(currentUser);
      } catch (fetchError) {
        console.error(fetchError);
      }

      navigate('/', { replace: true });
    } catch (err) {
      console.error(err);
      setError('로그인에 실패했습니다. 이메일/비밀번호를 확인하세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <h1>Inventory 로그인</h1>
        <p className={styles.subtitle}>재고 관리 시스템에 접근하려면 사내 계정으로 로그인하세요.</p>

        {error && <div className={styles.error}>{error}</div>}

        <label className={styles.field}>
          <span>이메일</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>

        <label className={styles.field}>
          <span>비밀번호</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>

        <button type="submit" className={styles.primaryButton} disabled={loading}>
          {loading ? '로그인 중...' : '로그인'}
        </button>

        <p className={styles.helperText}>테스트 계정: admin@example.com / ChangeMe123!</p>
      </form>
    </div>
  );
}

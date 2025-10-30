import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import brandLogo from '../../assets/media/logos/Lemetree_logo.png';
import { useAuth } from '../../hooks/useAuth';
import { fetchCurrentUser, login as loginRequest } from '../../services/authService';
import styles from './LoginPage.module.css';

interface EyeIconProps {
  hidden: boolean;
}

function EyeIcon({ hidden }: EyeIconProps) {
  return hidden ? (
    <svg
      className={styles.eyeIcon}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M2.1 3.51a.75.75 0 0 1 1.06-.11l18.75 14.5a.75.75 0 1 1-.94 1.17l-3.02-2.33A11.6 11.6 0 0 1 12 19.5c-4.54 0-8.58-2.73-10.7-7.02a1.8 1.8 0 0 1 0-1.6 12.7 12.7 0 0 1 3.6-4.37L2.21 4.57a.75.75 0 0 1-.11-1.06Zm4.7 3.63L6 7.81a10.8 10.8 0 0 0-2.88 3.46 3.42 3.42 0 0 0 0 3.06c1.85 3.73 5.27 5.67 8.88 5.67 1.58 0 3.1-.42 4.49-1.18l-2.27-1.76A4.5 4.5 0 0 1 8.8 9.13Zm4.25 5.25-3.29-2.54a2.99 2.99 0 0 0 3.29 2.54Z"
      />
      <path
        fill="currentColor"
        d="M12 5.5c4.54 0 8.58 2.73 10.7 7.02.37.75.37 1.62 0 2.37a12.7 12.7 0 0 1-2.14 3.08l-1.05-.81a10.8 10.8 0 0 0 1.92-2.66 3.42 3.42 0 0 0 0-3.06C19.58 7.71 16.16 5.5 12 5.5c-.92 0-1.82.12-2.67.35l-1.2-.93A11.45 11.45 0 0 1 12 5.5Z"
      />
    </svg>
  ) : (
    <svg
      className={styles.eyeIcon}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M12 5.5c4.54 0 8.58 2.73 10.7 7.02.37.75.37 1.62 0 2.37C20.58 20.27 16.54 23 12 23c-4.54 0-8.58-2.73-10.7-7.02a3.42 3.42 0 0 1 0-3.06C3.42 8.23 7.46 5.5 12 5.5Zm0 1.5c-3.61 0-7.03 1.94-8.88 5.67a1.92 1.92 0 0 0 0 1.66C4.97 18.06 8.39 20 12 20s7.03-1.94 8.88-5.67a1.92 1.92 0 0 0 0-1.66C19.03 8.94 15.61 7 12 7Zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Zm0 1.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"
      />
    </svg>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const { login, setUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rememberAccount, setRememberAccount] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const savedEmail = localStorage.getItem('login.rememberedEmail');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberAccount(true);
    }
  }, []);

  const handleRememberChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.checked;
    setRememberAccount(nextValue);

    if (!nextValue) {
      localStorage.removeItem('login.rememberedEmail');
    }
  };

  useEffect(() => {
    if (rememberAccount && email.trim().length > 0) {
      localStorage.setItem('login.rememberedEmail', email.trim());
    }
  }, [rememberAccount, email]);

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

      if (rememberAccount) {
        localStorage.setItem('login.rememberedEmail', email.trim());
      } else {
        localStorage.removeItem('login.rememberedEmail');
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
        <div className={styles.brand}>
          <img src={brandLogo} alt="Lremettre ERP 로고" />
        </div>
        <h1>Lremettre ERP 로그인</h1>
        <p className={styles.subtitle}>
          Lremettre ERP 재고 관리 시스템에 접근하려면 사내 계정으로 로그인하세요.
        </p>

        {error && <div className={styles.error}>{error}</div>}

        <label className={styles.field}>
          <span>이메일</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>

        <label className={styles.field}>
          <span>비밀번호</span>
          <div className={styles.passwordInputWrapper}>
            <input
              className={styles.passwordInput}
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className={styles.togglePasswordButton}
              onClick={() => setShowPassword((prev) => !prev)}
              aria-pressed={showPassword}
              aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 표시하기'}
            >
              <EyeIcon hidden={showPassword} />
              <span className={styles.visuallyHidden}>
                {showPassword ? '비밀번호 숨기기' : '비밀번호 표시하기'}
              </span>
            </button>
          </div>
        </label>

        <label className={styles.rememberRow}>
          <input type="checkbox" checked={rememberAccount} onChange={handleRememberChange} />
          <span>계정 자동 저장하기</span>
        </label>

        <button type="submit" className={styles.primaryButton} disabled={loading}>
          {loading ? '로그인 중...' : '로그인'}
        </button>
      </form>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { formatUserFriendlyError } from '@/lib/errorHandler';

export default function AdminLoginPage() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Проверяем, авторизован ли пользователь локально
  useEffect(() => {
    const storedAdmin = localStorage.getItem('admin_username');
    if (storedAdmin) {
      router.replace('/');
    } else {
      setLoading(false);
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSigningIn(true);
    setError(null);

    const enteredPassword = password.trim();

    if (!enteredPassword) {
      setError('Пожалуйста, введите ваш личный пароль.');
      setSigningIn(false);
      return;
    }

    try {
      // Ищем сотрудника с таким паролем в таблице admins
      const { data: adminsData, error: dbError } = await supabase
        .from('admins')
        .select('username, role')
        .eq('password', enteredPassword);

      if (dbError) {
        throw dbError;
      }

      if (!adminsData || adminsData.length === 0) {
        setError('Неверный пароль. Пожалуйста, проверьте введённые данные.');
        setSigningIn(false);
        return;
      }

      const adminUser = adminsData[0];

      // Сохраняем имя вошедшего сотрудника и его роль в локальное хранилище для сессии
      localStorage.setItem('admin_username', adminUser.username);
      localStorage.setItem('admin_role', adminUser.role ?? (adminUser.username === 'Администратор' ? 'admin' : 'employee'));

      // Перенаправляем на главную
      router.push('/');
    } catch (err: any) {
      console.error('Ошибка входа:', err);
      setError(formatUserFriendlyError(err, 'Произошла ошибка при попытке входа'));
    } finally {
      setSigningIn(false);
    }
  };

  if (loading) {
    return <div className="loading-spinner">Проверка доступа...</div>;
  }

  return (
    <div className="login-card">
      <h2 style={{ textAlign: 'center', marginBottom: '10px', fontSize: '24px' }}>Вход для сотрудников</h2>
      <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '15px', marginBottom: '25px' }}>
        Введите ваш личный пароль для доступа к управлению складом.
      </p>
      
      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={handleLogin}>
        <div className="input-group">
          <label className="input-label" htmlFor="password">
            Пароль сотрудника
          </label>
          <input
            id="password"
            type="password"
            className="input-field"
            placeholder="Введите пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            style={{ fontSize: '20px', padding: '14px 18px', textAlign: 'center', letterSpacing: '0.1em' }}
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: '100%', marginTop: '10px', fontSize: '18px' }}
          disabled={signingIn}
        >
          {signingIn ? 'Проверка...' : 'Войти на склад'}
        </button>
      </form>
    </div>
  );
}

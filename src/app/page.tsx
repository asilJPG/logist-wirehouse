'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface Part {
  id: string;
  name: string;
  article: string;
  brand: string;
  quantity: number;
  price: number;
  location: string | null;
  description: string | null;
}

export default function HomePage() {
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Функция для загрузки запчастей
  const fetchParts = async (query = '') => {
    try {
      setLoading(true);
      setError(null);

      let queryBuilder = supabase.from('parts').select('*');

      // Фильтр по поисковому запросу
      if (query.trim()) {
        const q = `%${query.trim()}%`;
        queryBuilder = queryBuilder.or(`name.ilike.${q},article.ilike.${q},brand.ilike.${q},description.ilike.${q}`);
      }

      // Сортировка по названию
      queryBuilder = queryBuilder.order('name', { ascending: true });

      const { data, error: fetchError } = await queryBuilder;

      if (fetchError) {
        throw fetchError;
      }

      setParts(data || []);
    } catch (err: any) {
      console.error('Ошибка при загрузке данных:', err);
      setError('Не удалось загрузить список запчастей. Убедитесь, что настроены переменные окружения Supabase.');
    } finally {
      setLoading(false);
    }
  };

  // Первоначальная загрузка данных при монтировании
  useEffect(() => {
    fetchParts(searchQuery);
  }, []);

  // Обработчик отправки формы поиска
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchParts(searchQuery);
  };

  // Форматирование цены
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(price);
  };

  return (
    <div>
      <div style={{ marginBottom: '25px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '32px', marginBottom: '10px' }}>Наличие запчастей на складе</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '18px' }}>
          Введите название детали, артикул (номер) или производителя, чтобы проверить наличие.
        </p>
      </div>

      {/* Панель поиска */}
      <div className="search-container">
        <form onSubmit={handleSearchSubmit} className="search-box">
          <input
            type="text"
            className="input-field search-input"
            placeholder="Например: Фильтр масляный, OP570, Bosch..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button type="submit" className="btn btn-primary search-btn">
            Найти
          </button>
        </form>
      </div>

      {/* Сообщения об ошибках или статусе загрузки */}
      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="loading-spinner">Загрузка данных со склада...</div>
      ) : parts.length === 0 ? (
        <div className="no-results">
          <p style={{ fontWeight: 'bold', fontSize: '20px', marginBottom: '10px' }}>Ничего не найдено</p>
          <p>Попробуйте ввести другое название или артикул.</p>
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                fetchParts('');
              }}
              className="btn btn-secondary btn-sm"
              style={{ marginTop: '15px' }}
            >
              Сбросить поиск
            </button>
          )}
        </div>
      ) : (
        <>
          <p style={{ marginBottom: '10px', color: 'var(--text-muted)' }}>
            Найдено позиций: <strong>{parts.length}</strong>
          </p>

          {/* Таблица для больших экранов */}
          <div className="table-wrapper">
            <table className="parts-table">
              <thead>
                <tr>
                  <th>Артикул</th>
                  <th>Бренд</th>
                  <th>Название</th>
                  <th>Цена</th>
                  <th>Наличие</th>
                  <th>Место</th>
                  <th>Описание</th>
                </tr>
              </thead>
              <tbody>
                {parts.map((part) => (
                  <tr key={part.id}>
                    <td style={{ fontWeight: 'bold', fontFamily: 'monospace', fontSize: '19px' }}>{part.article}</td>
                    <td>{part.brand}</td>
                    <td style={{ fontWeight: '600' }}>{part.name}</td>
                    <td style={{ color: 'var(--primary)', fontWeight: 'bold', fontSize: '19px' }}>{formatPrice(part.price)}</td>
                    <td>
                      {part.quantity > 0 ? (
                        <span className="status-badge status-in-stock">{part.quantity} шт.</span>
                      ) : (
                        <span className="status-badge status-out-of-stock">Нет</span>
                      )}
                    </td>
                    <td>{part.location || '—'}</td>
                    <td style={{ fontSize: '16px', color: 'var(--text-muted)' }}>{part.description || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Карточки для мобильных устройств */}
          <div className="parts-cards">
            {parts.map((part) => (
              <div key={part.id} className="part-card">
                <div className="part-card-title">{part.name}</div>
                <div className="part-card-row">
                  <span className="part-card-label">Артикул:</span>
                  <span className="part-card-value" style={{ fontFamily: 'monospace' }}>
                    {part.article}
                  </span>
                </div>
                <div className="part-card-row">
                  <span className="part-card-label">Производитель:</span>
                  <span className="part-card-value">{part.brand}</span>
                </div>
                <div className="part-card-row">
                  <span className="part-card-label">Цена:</span>
                  <span className="part-card-value" style={{ color: 'var(--primary)', fontSize: '19px' }}>
                    {formatPrice(part.price)}
                  </span>
                </div>
                <div className="part-card-row">
                  <span className="part-card-label">Наличие на складе:</span>
                  <span>
                    {part.quantity > 0 ? (
                      <span className="status-badge status-in-stock">{part.quantity} шт.</span>
                    ) : (
                      <span className="status-badge status-out-of-stock">Нет</span>
                    )}
                  </span>
                </div>
                <div className="part-card-row">
                  <span className="part-card-label">Место хранения:</span>
                  <span className="part-card-value">{part.location || '—'}</span>
                </div>
                {part.description && (
                  <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)', fontSize: '15px', color: 'var(--text-muted)' }}>
                    {part.description}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

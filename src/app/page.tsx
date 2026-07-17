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
  description: string | null;
  image_url: string | null;
}

export default function HomePage() {
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedPart, setSelectedPart] = useState<Part | null>(null);
  const [shareCopied, setShareCopied] = useState<string | null>(null);

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

  // Первоначальная загрузка данных при монтировании и проверка URL
  useEffect(() => {
    fetchParts(searchQuery);

    // Проверяем параметр 'part' в ссылке
    const params = new URLSearchParams(window.location.search);
    const partId = params.get('part');
    if (partId) {
      const fetchSinglePart = async () => {
        try {
          const { data, error: singleError } = await supabase
            .from('parts')
            .select('*')
            .eq('id', partId)
            .single();
          
          if (!singleError && data) {
            setSelectedPart(data as Part);
          }
        } catch (err) {
          console.error('Ошибка загрузки детали по ссылке:', err);
        }
      };
      fetchSinglePart();
    }
  }, []);

  // Обработчик отправки формы поиска
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchParts(searchQuery);
  };

  // Копирование ссылки на деталь в буфер обмена
  const handleShare = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Отключаем открытие карточки при клике на иконку поделиться
    const shareUrl = `${window.location.origin}/?part=${id}`;
    navigator.clipboard
      .writeText(shareUrl)
      .then(() => {
        setShareCopied(id);
        setTimeout(() => setShareCopied(null), 2000);
      })
      .catch((err) => {
        console.error('Ошибка при копировании ссылки:', err);
      });
  };

  // Форматирование цены (в сумы)
  const formatPrice = (price: number) => {
    const formatted = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 0 }).format(price);
    return `${formatted} сум`;
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

          {/* Сетка карточек запчастей */}
          <div className="parts-grid">
            {parts.map((part) => (
              <div
                key={part.id}
                className="part-card part-card-clickable"
                onClick={() => setSelectedPart(part)}
              >
                <div className="part-card-image-wrapper">
                  {part.image_url ? (
                    <img
                      src={part.image_url}
                      alt={part.name}
                      className="part-card-image"
                    />
                  ) : (
                    <span className="part-card-placeholder">📷</span>
                  )}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px' }}>
                  {part.brand}
                </div>
                <div className="part-card-title" style={{ fontSize: '18px', marginBottom: '8px', lineHeight: '1.3', height: '48px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {part.name}
                </div>
                <div className="part-card-row" style={{ marginBottom: '10px' }}>
                  <span className="part-card-label">Артикул:</span>
                  <span className="part-card-value" style={{ fontFamily: 'monospace' }}>{part.article}</span>
                </div>
                <div className="part-card-row" style={{ alignItems: 'center' }}>
                  <span style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--primary)' }}>
                    {formatPrice(part.price)}
                  </span>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ minHeight: '30px', padding: '4px 8px', fontSize: '13px' }}
                      title="Скопировать ссылку"
                      onClick={(e) => handleShare(e, part.id)}
                    >
                      {shareCopied === part.id ? '✓' : '🔗'}
                    </button>
                    {part.quantity > 0 ? (
                      <span className="status-badge status-in-stock">{part.quantity} шт.</span>
                    ) : (
                      <span className="status-badge status-out-of-stock">Нет</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Модальное окно просмотра деталей запчасти */}
      {selectedPart && (
        <div className="modal-overlay" onClick={() => setSelectedPart(null)}>
          <div
            className="modal-content"
            style={{
              maxWidth: '750px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              cursor: 'default',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Верхняя часть: Сетка с фото и инфо */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
              
              {/* Левая часть: фото */}
              <div style={{ width: '100%' }}>
                <div style={{ width: '100%', height: '280px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.01)' }}>
                  {selectedPart.image_url ? (
                    <img
                      src={selectedPart.image_url}
                      alt={selectedPart.name}
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  ) : (
                    <span style={{ fontSize: '72px', color: 'var(--text-muted)' }}>📷</span>
                  )}
                </div>
              </div>

              {/* Правая часть: инфо */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <span style={{ fontSize: '15px', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase' }}>
                      {selectedPart.brand}
                    </span>
                    <button
                      onClick={() => setSelectedPart(null)}
                      style={{ background: 'none', border: 'none', fontSize: '28px', color: 'var(--text-muted)', cursor: 'pointer', lineHeight: '0.5', padding: '5px' }}
                    >
                      &times;
                    </button>
                  </div>
                  
                  <h2 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '16px', lineHeight: '1.3' }}>
                    {selectedPart.name}
                  </h2>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px', borderTop: '1px solid var(--border)', paddingTop: '15px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Артикул:</span>
                      <strong style={{ fontFamily: 'monospace', fontSize: '17px' }}>{selectedPart.article}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Наличие:</span>
                      <strong>
                        {selectedPart.quantity > 0 ? (
                          <span className="status-badge status-in-stock">{selectedPart.quantity} шт.</span>
                        ) : (
                          <span className="status-badge status-out-of-stock">Нет в наличии</span>
                        )}
                      </strong>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '30px', fontWeight: 'bold', color: 'var(--primary)' }}>
                    {formatPrice(selectedPart.price)}
                  </div>
                  
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ minHeight: '38px', padding: '8px 16px', fontSize: '14px' }}
                    onClick={(e) => handleShare(e, selectedPart.id)}
                  >
                    {shareCopied === selectedPart.id ? '✓ Ссылка скопирована' : '🔗 Поделиться карточкой'}
                  </button>
                </div>
              </div>
            </div>

            {/* Описание детали под фото и инфо */}
            {selectedPart.description && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px', marginTop: '10px' }}>
                <h4 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '8px' }}>Описание / Применяемость:</h4>
                <p style={{ fontSize: '15px', color: 'var(--foreground)', whiteSpace: 'pre-line', lineHeight: '1.5' }}>
                  {selectedPart.description}
                </p>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}

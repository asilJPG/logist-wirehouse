'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface Part {
  id: string;
  name: string;
  article: string;
  quantity: number;
  price_uzs: number;
  price_usd: number;
  description: string | null;
  image_urls: string[] | null;
}

export default function HomePage() {
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedPart, setSelectedPart] = useState<Part | null>(null);
  const [activeImgIndex, setActiveImgIndex] = useState(0);
  const [shareCopied, setShareCopied] = useState<string | null>(null);

  // Функция для загрузки всех запчастей со склада
  const fetchParts = async () => {
    try {
      setLoading(true);
      setError(null);

      // Загружаем все запчасти за один раз для быстрого локального поиска
      const { data, error: fetchError } = await supabase
        .from('parts')
        .select('*')
        .order('name', { ascending: true });

      if (fetchError) {
        throw fetchError;
      }

      setParts(data || []);
    } catch (err: any) {
      console.error('Ошибка загрузки данных:', err);
      setError('Не удалось загрузить список запчастей. Проверьте интернет-соединение или обновите страницу.');
    } finally {
      setLoading(false);
    }
  };

  // Загрузка данных при монтировании и проверка ссылки
  useEffect(() => {
    fetchParts();

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
            setActiveImgIndex(0);
          }
        } catch (err) {
          console.error('Ошибка загрузки детали по ссылке:', err);
        }
      };
      fetchSinglePart();
    }
  }, []);

  // Копирование ссылки на деталь в буфер обмена
  const handleShare = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
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

  // Открытие детальной карточки запчасти
  const handleOpenPart = (part: Part) => {
    setSelectedPart(part);
    setActiveImgIndex(0);
  };

  // Форматирование цен
  const formatPriceUZS = (price: number) => {
    const formatted = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 0 }).format(price);
    return `${formatted} сум`;
  };

  const formatPriceUSD = (price: number) => {
    const formatted = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(price);
    return `$${formatted}`;
  };

  // Мгновенная фильтрация списка запчастей на клиенте по мере ввода
  const filteredParts = parts.filter((part) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      part.name.toLowerCase().includes(q) ||
      part.article.toLowerCase().includes(q) ||
      (part.description && part.description.toLowerCase().includes(q))
    );
  });

  // Получение основного изображения для карточки превью
  const getPreviewImage = (part: Part) => {
    if (part.image_urls && part.image_urls.length > 0) {
      return part.image_urls[0];
    }
    return null;
  };

  // Навигация по галерее картинок
  const handlePrevImage = (e: React.MouseEvent, imgLength: number) => {
    e.stopPropagation();
    setActiveImgIndex((prev) => (prev === 0 ? imgLength - 1 : prev - 1));
  };

  const handleNextImage = (e: React.MouseEvent, imgLength: number) => {
    e.stopPropagation();
    setActiveImgIndex((prev) => (prev === imgLength - 1 ? 0 : prev + 1));
  };

  return (
    <div>
      <div style={{ marginBottom: '25px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '32px', marginBottom: '10px' }}>Наличие запчастей на складе</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '18px' }}>
          Введите название детали или артикул (номер) — список обновится мгновенно.
        </p>
      </div>

      {/* Панель поиска без кнопки */}
      <div className="search-container" style={{ padding: '15px 20px', marginBottom: '25px' }}>
        <div className="search-box">
          <input
            type="text"
            className="input-field search-input"
            placeholder="Поиск по названию, артикулу или бренду"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', fontSize: '18px', padding: '12px 18px', borderRadius: '8px' }}
          />
        </div>
      </div>

      {/* Сообщения об ошибках или статусе загрузки */}
      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="loading-spinner">Загрузка данных со склада...</div>
      ) : filteredParts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-muted)' }}>
          <p style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '5px' }}>Товары не найдены</p>
          <p style={{ fontSize: '15px' }}>Попробуйте ввести другой артикул или название детали.</p>
        </div>
      ) : (
        <>
          <p style={{ marginBottom: '15px', color: 'var(--text-muted)', fontSize: '15px' }}>
            Найдено позиций: <strong>{filteredParts.length}</strong>
          </p>

          {/* Сетка карточек запчастей */}
          <div className="parts-grid">
            {filteredParts.map((part) => {
              const previewImg = getPreviewImage(part);
              return (
                <div
                  key={part.id}
                  className="part-card part-card-clickable"
                  onClick={() => handleOpenPart(part)}
                >
                  <div className="part-card-image-wrapper">
                    {previewImg ? (
                      <img
                        src={previewImg}
                        alt={part.name}
                        className="part-card-image"
                      />
                    ) : (
                      <span className="part-card-placeholder">📷</span>
                    )}
                  </div>
                  <div className="part-card-title" style={{ fontSize: '18px', marginBottom: '8px', lineHeight: '1.3', height: '48px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {part.name}
                  </div>
                  <div className="part-card-row" style={{ marginBottom: '10px' }}>
                    <span className="part-card-label">Артикул:</span>
                    <span className="part-card-value" style={{ fontFamily: 'monospace' }}>{part.article}</span>
                  </div>
                  <div className="part-card-row" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '19px', fontWeight: 'bold', color: 'var(--primary)' }}>
                        {formatPriceUZS(part.price_uzs)}
                      </span>
                      <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: '600' }}>
                        {formatPriceUSD(part.price_usd)}
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginLeft: 'auto' }}>
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
              );
            })}
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
              
              {/* Левая часть: фотогалерея */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{
                  width: '100%',
                  height: '280px',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(0,0,0,0.01)',
                  position: 'relative'
                }}>
                  {selectedPart.image_urls && selectedPart.image_urls.length > 0 ? (
                    <>
                      <img
                        src={selectedPart.image_urls[activeImgIndex]}
                        alt={selectedPart.name}
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                      
                      {/* Стрелки перелистывания */}
                      {selectedPart.image_urls.length > 1 && (
                        <>
                          <button
                            onClick={(e) => handlePrevImage(e, selectedPart.image_urls!.length)}
                            style={{
                              position: 'absolute',
                              left: '10px',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              backgroundColor: 'rgba(0,0,0,0.4)',
                              color: 'white',
                              border: 'none',
                              width: '36px',
                              height: '36px',
                              borderRadius: '50%',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '18px',
                              fontWeight: 'bold',
                              userSelect: 'none',
                              zIndex: 10
                            }}
                          >
                            ‹
                          </button>
                          <button
                            onClick={(e) => handleNextImage(e, selectedPart.image_urls!.length)}
                            style={{
                              position: 'absolute',
                              right: '10px',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              backgroundColor: 'rgba(0,0,0,0.4)',
                              color: 'white',
                              border: 'none',
                              width: '36px',
                              height: '36px',
                              borderRadius: '50%',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '18px',
                              fontWeight: 'bold',
                              userSelect: 'none',
                              zIndex: 10
                            }}
                          >
                            ›
                          </button>
                        </>
                      )}
                    </>
                  ) : (
                    <span style={{ fontSize: '72px', color: 'var(--text-muted)' }}>📷</span>
                  )}
                </div>

                {/* Линейка миниатюр под большим фото */}
                {selectedPart.image_urls && selectedPart.image_urls.length > 1 && (
                  <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                    {selectedPart.image_urls.map((url, idx) => (
                      <img
                        key={idx}
                        src={url}
                        alt={`mini-${idx}`}
                        onClick={() => setActiveImgIndex(idx)}
                        style={{
                          width: '60px',
                          height: '45px',
                          objectFit: 'cover',
                          borderRadius: '6px',
                          border: activeImgIndex === idx ? '2px solid var(--primary)' : '1px solid var(--border)',
                          cursor: 'pointer',
                          opacity: activeImgIndex === idx ? 1 : 0.6,
                          transition: 'all 0.15s ease'
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Правая часть: инфо */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
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

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--primary)', lineHeight: '1.1' }}>
                      {formatPriceUZS(selectedPart.price_uzs)}
                    </div>
                    <div style={{ fontSize: '18px', color: 'var(--text-muted)', fontWeight: 'bold' }}>
                      {formatPriceUSD(selectedPart.price_usd)}
                    </div>
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

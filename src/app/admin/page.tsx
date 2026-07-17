'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  image_url: string | null;
}

interface AdminUser {
  id: string;
  username: string;
  password: string;
}

export default function AdminDashboardPage() {
  const [adminName, setAdminName] = useState<string>('');
  const [authLoading, setAuthLoading] = useState(true);
  const [parts, setParts] = useState<Part[]>([]);
  const [partsLoading, setPartsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Список сотрудников и управление доступом
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [showAdminsModal, setShowAdminsModal] = useState(false);
  const [newAdminUsername, setNewAdminUsername] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [addingAdmin, setAddingAdmin] = useState(false);

  // Состояние для формы добавления товара
  const [newName, setNewName] = useState('');
  const [newArticle, setNewArticle] = useState('');
  const [newBrand, setNewBrand] = useState('');
  const [newPrice, setNewPrice] = useState('0');
  const [newQuantity, setNewQuantity] = useState('0');
  const [newLocation, setNewLocation] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [addingPart, setAddingPart] = useState(false);

  // Состояние для редактирования товара в модальном окне
  const [editingPart, setEditingPart] = useState<Part | null>(null);
  const [editName, setEditName] = useState('');
  const [editArticle, setEditArticle] = useState('');
  const [editBrand, setEditBrand] = useState('');
  const [editPrice, setEditPrice] = useState('0');
  const [editQuantity, setEditQuantity] = useState('0');
  const [editLocation, setEditLocation] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editImageUrl, setEditImageUrl] = useState<string | null>(null);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Состояния для быстрого inline-редактирования
  const [tempPrices, setTempPrices] = useState<{ [key: string]: string }>({});
  const [tempQuantities, setTempQuantities] = useState<{ [key: string]: string }>({});

  const router = useRouter();

  // Проверка сессии при загрузке страницы
  useEffect(() => {
    const checkAuth = () => {
      const storedAdmin = localStorage.getItem('admin_username');
      if (!storedAdmin) {
        router.replace('/admin/login');
      } else {
        setAdminName(storedAdmin);
        fetchParts();
        fetchAdmins();
        setAuthLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  // Загрузка сотрудников
  const fetchAdmins = async () => {
    try {
      const { data, error } = await supabase.from('admins').select('*').order('username', { ascending: true });
      if (error) throw error;
      setAdmins(data || []);
    } catch (err) {
      console.error('Ошибка загрузки сотрудников:', err);
    }
  };

  // Загрузка запчастей
  const fetchParts = async (query = '') => {
    try {
      setPartsLoading(true);
      setError(null);

      let queryBuilder = supabase.from('parts').select('*');

      if (query.trim()) {
        const q = `%${query.trim()}%`;
        queryBuilder = queryBuilder.or(`name.ilike.${q},article.ilike.${q},brand.ilike.${q},description.ilike.${q}`);
      }

      queryBuilder = queryBuilder.order('name', { ascending: true });

      const { data, error: fetchError } = await queryBuilder;

      if (fetchError) {
        throw fetchError;
      }

      const partsData = (data as Part[]) || [];
      setParts(partsData);

      // Инициализируем временные значения для быстрого inline-редактирования
      const prices: { [key: string]: string } = {};
      const quantities: { [key: string]: string } = {};
      partsData.forEach((part) => {
        prices[part.id] = part.price.toString();
        quantities[part.id] = part.quantity.toString();
      });
      setTempPrices(prices);
      setTempQuantities(quantities);
    } catch (err: any) {
      console.error('Ошибка загрузки данных:', err);
      setError(`Ошибка базы данных: ${err.message}`);
    } finally {
      setPartsLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchParts(searchQuery);
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_username');
    router.replace('/');
  };

  // Загрузка изображения в Supabase Storage
  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      // Генерируем уникальное имя файла
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
      const filePath = `parts/${fileName}`;

      const { data, error: uploadError } = await supabase.storage
        .from('part-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Получаем публичную ссылку
      const { data: urlData } = supabase.storage
        .from('part-images')
        .getPublicUrl(filePath);

      return urlData.publicUrl;
    } catch (err: any) {
      console.error('Ошибка загрузки файла в хранилище:', err);
      alert(`Не удалось загрузить фотографию: ${err.message}. Убедитесь, что бакет "part-images" создан в Storage в Supabase и разрешены анонимные загрузки (policies).`);
      return null;
    }
  };

  // Добавление нового сотрудника
  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminUsername.trim() || !newAdminPassword.trim()) {
      alert('Пожалуйста, заполните имя и пароль.');
      return;
    }
    setAddingAdmin(true);

    try {
      const { error: insertError } = await supabase.from('admins').insert([
        {
          username: newAdminUsername.trim(),
          password: newAdminPassword.trim(),
        },
      ]);

      if (insertError) throw insertError;

      setNewAdminUsername('');
      setNewAdminPassword('');
      fetchAdmins();
      alert('Сотрудник успешно добавлен!');
    } catch (err: any) {
      console.error('Ошибка при добавлении сотрудника:', err);
      alert(`Не удалось добавить сотрудника: ${err.message}`);
    } finally {
      setAddingAdmin(false);
    }
  };

  // Удаление сотрудника
  const handleDeleteAdmin = async (id: string, name: string) => {
    if (name === 'Администратор') {
      alert('Нельзя удалить главного администратора.');
      return;
    }

    if (name === adminName) {
      alert('Вы не можете удалить самого себя из текущей сессии.');
      return;
    }

    if (!confirm(`Вы действительно хотите аннулировать пароль и доступ сотрудника "${name}"?`)) {
      return;
    }

    try {
      const { error: deleteError } = await supabase.from('admins').delete().eq('id', id);
      if (deleteError) throw deleteError;
      fetchAdmins();
    } catch (err: any) {
      console.error('Ошибка удаления сотрудника:', err);
      alert(`Не удалось удалить: ${err.message}`);
    }
  };

  // Добавление новой детали
  const handleAddPart = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingPart(true);
    setError(null);
    setSuccessMessage(null);

    const priceNum = parseFloat(newPrice);
    const qtyNum = parseInt(newQuantity, 10);

    if (isNaN(priceNum) || priceNum < 0) {
      setError('Пожалуйста, введите корректную цену.');
      setAddingPart(false);
      return;
    }

    if (isNaN(qtyNum) || qtyNum < 0) {
      setError('Пожалуйста, введите корректное количество.');
      setAddingPart(false);
      return;
    }

    try {
      let imageUrl: string | null = null;
      if (newImageFile) {
        imageUrl = await uploadImage(newImageFile);
      }

      const { error: insertError } = await supabase.from('parts').insert([
        {
          name: newName.trim(),
          article: newArticle.trim(),
          brand: newBrand.trim(),
          price: priceNum,
          quantity: qtyNum,
          location: newLocation.trim() || null,
          description: newDescription.trim() || null,
          image_url: imageUrl,
        },
      ]);

      if (insertError) {
        throw insertError;
      }

      setSuccessMessage(`Запчасть "${newName}" успешно добавлена на склад!`);
      // Очистка формы
      setNewName('');
      setNewArticle('');
      setNewBrand('');
      setNewPrice('0');
      setNewQuantity('0');
      setNewLocation('');
      setNewDescription('');
      setNewImageFile(null);
      
      // Сброс input-файла
      const fileInput = document.getElementById('new-part-image') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      // Перезагрузка списка деталей
      fetchParts(searchQuery);
    } catch (err: any) {
      console.error('Ошибка добавления детали:', err);
      setError(`Не удалось добавить деталь: ${err.message}`);
    } finally {
      setAddingPart(false);
    }
  };

  // Открытие модального окна для редактирования детали
  const openEditModal = (part: Part) => {
    setEditingPart(part);
    setEditName(part.name);
    setEditArticle(part.article);
    setEditBrand(part.brand);
    setEditPrice(part.price.toString());
    setEditQuantity(part.quantity.toString());
    setEditLocation(part.location || '');
    setEditDescription(part.description || '');
    setEditImageUrl(part.image_url);
    setEditImageFile(null);
  };

  // Сохранение изменений из модального окна
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPart) return;

    setSavingEdit(true);
    setError(null);
    setSuccessMessage(null);

    const priceNum = parseFloat(editPrice);
    const qtyNum = parseInt(editQuantity, 10);

    if (isNaN(priceNum) || priceNum < 0) {
      setError('Введите корректную цену.');
      setSavingEdit(false);
      return;
    }

    if (isNaN(qtyNum) || qtyNum < 0) {
      setError('Введите корректное количество.');
      setSavingEdit(false);
      return;
    }

    try {
      let finalImageUrl = editImageUrl;
      if (editImageFile) {
        const uploadedUrl = await uploadImage(editImageFile);
        if (uploadedUrl) {
          finalImageUrl = uploadedUrl;
        }
      }

      const { error: updateError } = await supabase
        .from('parts')
        .update({
          name: editName.trim(),
          article: editArticle.trim(),
          brand: editBrand.trim(),
          price: priceNum,
          quantity: qtyNum,
          location: editLocation.trim() || null,
          description: editDescription.trim() || null,
          image_url: finalImageUrl,
        })
        .eq('id', editingPart.id);

      if (updateError) {
        throw updateError;
      }

      setSuccessMessage(`Данные запчасти "${editName}" сохранены!`);
      setEditingPart(null);
      fetchParts(searchQuery);
    } catch (err: any) {
      console.error('Ошибка обновления детали:', err);
      setError(`Не удалось обновить деталь: ${err.message}`);
    } finally {
      setSavingEdit(false);
    }
  };

  // Быстрое изменение цены (inline)
  const handleQuickPriceSave = async (id: string, name: string) => {
    const rawVal = tempPrices[id];
    const priceNum = parseFloat(rawVal);

    if (isNaN(priceNum) || priceNum < 0) {
      alert('Пожалуйста, введите корректную цену.');
      return;
    }

    try {
      const { error: updateError } = await supabase
        .from('parts')
        .update({ price: priceNum })
        .eq('id', id);

      if (updateError) {
        throw updateError;
      }

      // Обновляем локальное состояние, чтобы отобразить сохраненное значение
      setParts(parts.map((p) => (p.id === id ? { ...p, price: priceNum } : p)));
      alert(`Цена для "${name}" обновлена на ${priceNum} руб.`);
    } catch (err: any) {
      console.error('Ошибка быстрого сохранения цены:', err);
      alert(`Ошибка обновления цены: ${err.message}`);
    }
  };

  // Быстрое изменение количества (inline)
  const handleQuickQuantitySave = async (id: string, quantity: number, name: string) => {
    if (quantity < 0) {
      alert('Количество не может быть меньше 0.');
      return;
    }

    try {
      const { error: updateError } = await supabase
        .from('parts')
        .update({ quantity })
        .eq('id', id);

      if (updateError) {
        throw updateError;
      }

      // Обновляем локальные значения
      setParts(parts.map((p) => (p.id === id ? { ...p, quantity } : p)));
      setTempQuantities({ ...tempQuantities, [id]: quantity.toString() });
    } catch (err: any) {
      console.error('Ошибка быстрого сохранения количества:', err);
      alert(`Ошибка обновления количества: ${err.message}`);
    }
  };

  // Удаление детали
  const handleDeletePart = async (id: string, name: string) => {
    if (!confirm(`Вы действительно хотите удалить запчасть "${name}" со склада?`)) {
      return;
    }

    setError(null);
    setSuccessMessage(null);

    try {
      const { error: deleteError } = await supabase.from('parts').delete().eq('id', id);

      if (deleteError) {
        throw deleteError;
      }

      setSuccessMessage(`Запчасть "${name}" успешно удалена.`);
      fetchParts(searchQuery);
    } catch (err: any) {
      console.error('Ошибка удаления детали:', err);
      setError(`Не удалось удалить деталь: ${err.message}`);
    }
  };

  if (authLoading) {
    return <div className="loading-spinner">Проверка прав доступа...</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h1 style={{ fontSize: '32px' }}>Панель управления складом</h1>
          <p style={{ color: 'var(--text-muted)' }}>Сотрудник: <strong>{adminName}</strong></p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setShowAdminsModal(true)} className="btn btn-secondary">
            👥 Доступы сотрудников
          </button>
          <button onClick={handleLogout} className="btn btn-danger">
            🚪 Выйти
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {successMessage && <div className="alert alert-success">{successMessage}</div>}

      <div className="admin-grid">
        {/* Левая часть: Список товаров и Поиск */}
        <div className="admin-list-container">
          <h2 style={{ fontSize: '24px', marginBottom: '15px' }}>Товары на складе</h2>
          
          <div className="search-container" style={{ marginBottom: '20px' }}>
            <form onSubmit={handleSearchSubmit} className="search-box">
              <input
                type="text"
                className="input-field search-input"
                placeholder="Поиск по складу (название, артикул, бренд)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ fontSize: '18px', padding: '10px 15px' }}
              />
              <button type="submit" className="btn btn-primary" style={{ padding: '10px 20px', fontSize: '18px', minHeight: 'auto' }}>
                Искать
              </button>
            </form>
          </div>

          {partsLoading ? (
            <div className="loading-spinner">Загрузка данных...</div>
          ) : parts.length === 0 ? (
            <div className="no-results" style={{ padding: '25px' }}>
              Деталей на складе не найдено. Добавьте первый товар справа или измените поиск.
            </div>
          ) : (
            <>
              {/* Таблица запчастей для ПК */}
              <div className="table-wrapper">
                <table className="parts-table" style={{ fontSize: '16px' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '70px' }}>Фото</th>
                      <th>Артикул / Бренд</th>
                      <th>Название / Место</th>
                      <th>Цена (руб.)</th>
                      <th>Количество</th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parts.map((part) => {
                      const isPriceChanged = tempPrices[part.id] !== part.price.toString();

                      return (
                        <tr key={part.id}>
                          {/* Изображение детали */}
                          <td>
                            {part.image_url ? (
                              <img
                                src={part.image_url}
                                alt={part.name}
                                style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--border)' }}
                              />
                            ) : (
                              <div style={{ width: '40px', height: '40px', backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', color: 'var(--text-muted)', border: '1px dashed var(--border)' }}>
                                📷
                              </div>
                            )}
                          </td>
                          {/* Артикул и Бренд */}
                          <td>
                            <strong style={{ fontFamily: 'monospace', fontSize: '18px', display: 'block' }}>{part.article}</strong>
                            <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{part.brand}</span>
                          </td>
                          {/* Название и место */}
                          <td>
                            <strong style={{ display: 'block' }}>{part.name}</strong>
                            <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                              Место: {part.location || 'не указано'}
                            </span>
                          </td>
                          {/* Inline Цена */}
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              <input
                                type="number"
                                step="0.01"
                                className="quick-edit-input"
                                value={tempPrices[part.id] || ''}
                                onChange={(e) => setTempPrices({ ...tempPrices, [part.id]: e.target.value })}
                              />
                              <button
                                onClick={() => handleQuickPriceSave(part.id, part.name)}
                                className={`btn btn-sm ${isPriceChanged ? 'btn-primary' : 'btn-secondary'}`}
                                style={{ minHeight: 'auto', padding: '6px 10px' }}
                                title="Сохранить цену"
                              >
                                ✓
                              </button>
                            </div>
                          </td>
                          {/* Inline Количество */}
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <button
                                onClick={() => handleQuickQuantitySave(part.id, part.quantity - 1, part.name)}
                                className="quantity-btn"
                                type="button"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                className="quick-edit-input"
                                value={tempQuantities[part.id] || ''}
                                onChange={(e) => setTempQuantities({ ...tempQuantities, [part.id]: e.target.value })}
                                onBlur={() => {
                                  const val = parseInt(tempQuantities[part.id], 10);
                                  if (!isNaN(val) && val !== part.quantity) {
                                    handleQuickQuantitySave(part.id, val, part.name);
                                  }
                                }}
                                style={{ width: '60px', marginRight: '0' }}
                              />
                              <button
                                onClick={() => handleQuickQuantitySave(part.id, part.quantity + 1, part.name)}
                                className="quantity-btn"
                                type="button"
                              >
                                +
                              </button>
                            </div>
                          </td>
                          {/* Действия */}
                          <td>
                            <div style={{ display: 'flex', gap: '5px' }}>
                              <button
                                onClick={() => openEditModal(part)}
                                className="btn btn-sm btn-secondary"
                                style={{ minHeight: 'auto' }}
                              >
                                Изменить
                              </button>
                              <button
                                onClick={() => handleDeletePart(part.id, part.name)}
                                className="btn btn-sm btn-danger"
                                style={{ minHeight: 'auto' }}
                              >
                                Удалить
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Карточки запчастей для Мобильных */}
              <div className="parts-cards">
                {parts.map((part) => (
                  <div key={part.id} className="part-card">
                    {part.image_url && (
                      <div style={{ width: '100%', height: '140px', overflow: 'hidden', borderRadius: '6px', border: '1px solid var(--border)', marginBottom: '12px' }}>
                        <img src={part.image_url} alt={part.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    )}
                    <div className="part-card-title">{part.name}</div>
                    <div className="part-card-row">
                      <span className="part-card-label">Артикул:</span>
                      <span className="part-card-value" style={{ fontFamily: 'monospace' }}>{part.article}</span>
                    </div>
                    <div className="part-card-row">
                      <span className="part-card-label">Производитель:</span>
                      <span className="part-card-value">{part.brand}</span>
                    </div>
                    
                    {/* Inline цена для мобильных */}
                    <div className="part-card-row" style={{ alignItems: 'center' }}>
                      <span className="part-card-label">Цена (руб.):</span>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <input
                          type="number"
                          step="0.01"
                          className="quick-edit-input"
                          value={tempPrices[part.id] || ''}
                          onChange={(e) => setTempPrices({ ...tempPrices, [part.id]: e.target.value })}
                          style={{ width: '100px' }}
                        />
                        <button
                          onClick={() => handleQuickPriceSave(part.id, part.name)}
                          className="btn btn-sm btn-primary"
                          style={{ minHeight: 'auto', padding: '6px 10px' }}
                        >
                          Сохранить
                        </button>
                      </div>
                    </div>

                    {/* Inline количество для мобильных */}
                    <div className="part-card-row" style={{ alignItems: 'center' }}>
                      <span className="part-card-label">Количество:</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <button
                          onClick={() => handleQuickQuantitySave(part.id, part.quantity - 1, part.name)}
                          className="quantity-btn"
                          type="button"
                        >
                          -
                        </button>
                        <span style={{ minWidth: '40px', textAlign: 'center', fontWeight: 'bold', fontSize: '18px' }}>
                          {part.quantity} шт.
                        </span>
                        <button
                          onClick={() => handleQuickQuantitySave(part.id, part.quantity + 1, part.name)}
                          className="quantity-btn"
                          type="button"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="part-card-row">
                      <span className="part-card-label">Место:</span>
                      <span className="part-card-value">{part.location || 'не указано'}</span>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                      <button
                        onClick={() => openEditModal(part)}
                        className="btn btn-sm btn-secondary"
                        style={{ flexGrow: 1, minHeight: '40px' }}
                      >
                        Редактировать всё
                      </button>
                      <button
                        onClick={() => handleDeletePart(part.id, part.name)}
                        className="btn btn-sm btn-danger"
                        style={{ flexGrow: 1, minHeight: '40px' }}
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Правая часть: Форма добавления нового товара */}
        <div className="admin-form-container">
          <div className="admin-form-card">
            <h3 style={{ fontSize: '22px', marginBottom: '15px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
              Добавить запчасть
            </h3>
            
            <form onSubmit={handleAddPart}>
              <div className="input-group">
                <label className="input-label" style={{ fontSize: '16px' }}>Артикул (номер детали) *</label>
                <input
                  type="text"
                  className="input-field"
                  style={{ padding: '8px 12px', fontSize: '16px' }}
                  placeholder="Например: OP570T"
                  value={newArticle}
                  onChange={(e) => setNewArticle(e.target.value)}
                  required
                />
              </div>

              <div className="input-group">
                <label className="input-label" style={{ fontSize: '16px' }}>Производитель (бренд) *</label>
                <input
                  type="text"
                  className="input-field"
                  style={{ padding: '8px 12px', fontSize: '16px' }}
                  placeholder="Например: Filtron"
                  value={newBrand}
                  onChange={(e) => setNewBrand(e.target.value)}
                  required
                />
              </div>

              <div className="input-group">
                <label className="input-label" style={{ fontSize: '16px' }}>Название запчасти *</label>
                <input
                  type="text"
                  className="input-field"
                  style={{ padding: '8px 12px', fontSize: '16px' }}
                  placeholder="Например: Фильтр масляный"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="input-group">
                  <label className="input-label" style={{ fontSize: '16px' }}>Цена (руб.) *</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input-field"
                    style={{ padding: '8px 12px', fontSize: '16px' }}
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    required
                  />
                </div>

                <div className="input-group">
                  <label className="input-label" style={{ fontSize: '16px' }}>Кол-во на складе *</label>
                  <input
                    type="number"
                    className="input-field"
                    style={{ padding: '8px 12px', fontSize: '16px' }}
                    value={newQuantity}
                    onChange={(e) => setNewQuantity(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="input-group">
                <label className="input-label" style={{ fontSize: '16px' }}>Место на складе</label>
                <input
                  type="text"
                  className="input-field"
                  style={{ padding: '8px 12px', fontSize: '16px' }}
                  placeholder="Например: Стеллаж А, Полка 3"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                />
              </div>

              <div className="input-group">
                <label className="input-label" style={{ fontSize: '16px' }}>Описание / Применяемость</label>
                <textarea
                  className="input-field"
                  style={{ padding: '8px 12px', fontSize: '16px', minHeight: '80px', fontFamily: 'inherit' }}
                  placeholder="Например: Подходит для Ford Focus 2, 1.6"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                />
              </div>

              <div className="input-group">
                <label className="input-label" style={{ fontSize: '16px' }}>Фотография запчасти</label>
                <input
                  id="new-part-image"
                  type="file"
                  accept="image/*"
                  className="input-field"
                  style={{ padding: '8px 12px', fontSize: '15px' }}
                  onChange={(e) => setNewImageFile(e.target.files?.[0] || null)}
                />
              </div>

              <button
                type="submit"
                className="btn btn-success"
                style={{ width: '100%', marginTop: '10px', minHeight: '44px' }}
                disabled={addingPart}
              >
                {addingPart ? 'Добавление...' : '➕ Добавить на склад'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Модальное окно редактирования запчасти (редактировать всё) */}
      {editingPart && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span className="modal-title">Редактирование: {editingPart.name}</span>
              <button onClick={() => setEditingPart(null)} className="modal-close">
                &times;
              </button>
            </div>
            
            <form onSubmit={handleSaveEdit}>
              <div className="input-group">
                <label className="input-label">Артикул (номер детали) *</label>
                <input
                  type="text"
                  className="input-field"
                  value={editArticle}
                  onChange={(e) => setEditArticle(e.target.value)}
                  required
                />
              </div>

              <div className="input-group">
                <label className="input-label">Производитель (бренд) *</label>
                <input
                  type="text"
                  className="input-field"
                  value={editBrand}
                  onChange={(e) => setEditBrand(e.target.value)}
                  required
                />
              </div>

              <div className="input-group">
                <label className="input-label">Название запчасти *</label>
                <input
                  type="text"
                  className="input-field"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="input-group">
                  <label className="input-label">Цена (руб.) *</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input-field"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    required
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Кол-во на складе *</label>
                  <input
                    type="number"
                    className="input-field"
                    value={editQuantity}
                    onChange={(e) => setEditQuantity(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Место на складе</label>
                <input
                  type="text"
                  className="input-field"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                />
              </div>

              <div className="input-group">
                <label className="input-label">Описание / Применяемость</label>
                <textarea
                  className="input-field"
                  style={{ minHeight: '100px', fontFamily: 'inherit' }}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                />
              </div>

              {/* Отображение текущего фото и выбор нового */}
              <div className="input-group">
                <label className="input-label">Фотография запчасти</label>
                {editImageUrl && (
                  <div style={{ marginBottom: '10px' }}>
                    <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '5px' }}>Текущее фото:</p>
                    <img src={editImageUrl} alt="Текущее фото" style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border)' }} />
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="input-field"
                  style={{ padding: '8px 12px', fontSize: '15px' }}
                  onChange={(e) => setEditImageFile(e.target.files?.[0] || null)}
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setEditingPart(null)}
                  className="btn btn-secondary"
                  style={{ minHeight: '44px' }}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ minHeight: '44px' }}
                  disabled={savingEdit}
                >
                  {savingEdit ? 'Сохранение...' : 'Сохранить изменения'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно управления доступом сотрудников */}
      {showAdminsModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <span className="modal-title">👥 Доступы сотрудников</span>
              <button onClick={() => setShowAdminsModal(false)} className="modal-close">
                &times;
              </button>
            </div>

            <div style={{ marginBottom: '25px' }}>
              <h4 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '10px' }}>Список сотрудников</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px', backgroundColor: 'var(--background)' }}>
                {admins.map((adm) => (
                  <div key={adm.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--card-bg)', borderRadius: '4px' }}>
                    <div style={{ display: 'flex', flexGrow: 1, justifyContent: 'space-between', alignItems: 'center', marginRight: '10px' }}>
                      <strong style={{ fontSize: '15px' }}>{adm.username}</strong>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>Пароль: {adm.password}</span>
                    </div>
                    {adm.username !== 'Администратор' && adm.username !== adminName && (
                      <button
                        onClick={() => handleDeleteAdmin(adm.id, adm.username)}
                        className="btn btn-sm btn-danger"
                        style={{ minHeight: 'auto', padding: '4px 8px', fontSize: '12px' }}
                      >
                        Удалить
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={handleAddAdmin} style={{ borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
              <h4 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '15px' }}>Добавить сотрудника</h4>
              
              <div className="input-group" style={{ marginBottom: '12px' }}>
                <label className="input-label" style={{ fontSize: '14px', marginBottom: '4px' }}>Имя сотрудника</label>
                <input
                  type="text"
                  className="input-field"
                  style={{ padding: '8px 12px', fontSize: '15px' }}
                  placeholder="Например: Иван Иванов"
                  value={newAdminUsername}
                  onChange={(e) => setNewAdminUsername(e.target.value)}
                  required
                />
              </div>

              <div className="input-group" style={{ marginBottom: '15px' }}>
                <label className="input-label" style={{ fontSize: '14px', marginBottom: '4px' }}>Пароль для входа</label>
                <input
                  type="text"
                  className="input-field"
                  style={{ padding: '8px 12px', fontSize: '15px' }}
                  placeholder="Задайте надежный пароль"
                  value={newAdminPassword}
                  onChange={(e) => setNewAdminPassword(e.target.value)}
                  required
                />
              </div>

              <div className="modal-actions" style={{ marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAdminsModal(false)}
                  className="btn btn-secondary"
                  style={{ minHeight: '38px', padding: '6px 16px' }}
                >
                  Закрыть
                </button>
                <button
                  type="submit"
                  className="btn btn-success"
                  style={{ minHeight: '38px', padding: '6px 16px' }}
                  disabled={addingAdmin}
                >
                  {addingAdmin ? 'Добавление...' : 'Добавить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

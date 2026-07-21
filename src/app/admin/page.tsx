'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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

interface AdminUser {
  id: string;
  username: string;
  password: string;
  role: string | null;
}

interface WriteOff {
  id: string;
  part_id: string | null;
  part_name: string;
  part_article: string;
  quantity: number;
  comment: string | null;
  created_by: string;
  device: string | null;
  created_at: string;
}

export default function AdminDashboardPage() {
  const [adminName, setAdminName] = useState<string>('');
  const [adminRole, setAdminRole] = useState<string>('');
  const [authLoading, setAuthLoading] = useState(true);
  const [parts, setParts] = useState<Part[]>([]);
  const [partsLoading, setPartsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Навигация по вкладкам
  const [activeTab, setActiveTab] = useState<'parts' | 'writeoffs'>('parts');

  // Журнал списаний
  const [writeoffs, setWriteoffs] = useState<WriteOff[]>([]);
  const [writeoffsLoading, setWriteoffsLoading] = useState(false);

  // Модалка проведения списания
  const [showWriteOffModal, setShowWriteOffModal] = useState(false);
  const [writeOffPart, setWriteOffPart] = useState<Part | null>(null);
  const [writeOffQty, setWriteOffQty] = useState('1');
  const [writeOffComment, setWriteOffComment] = useState('');
  const [writeOffBy, setWriteOffBy] = useState('');

  // Список сотрудников и управление доступом
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [showAdminsModal, setShowAdminsModal] = useState(false);
  const [newAdminUsername, setNewAdminUsername] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newAdminRole, setNewAdminRole] = useState<'admin' | 'manager' | 'employee'>('employee');
  const [addingAdmin, setAddingAdmin] = useState(false);

  // Состояние для формы добавления товара
  const [newName, setNewName] = useState('');
  const [newArticle, setNewArticle] = useState('');
  const [newPriceUZS, setNewPriceUZS] = useState('0');
  const [newPriceUSD, setNewPriceUSD] = useState('0');
  const [newQuantity, setNewQuantity] = useState('0');
  const [newDescription, setNewDescription] = useState('');
  const [newImageFiles, setNewImageFiles] = useState<File[]>([]);
  const [newImagePreviews, setNewImagePreviews] = useState<string[]>([]);
  const [addingPart, setAddingPart] = useState(false);
  
  // Состояния для обрезки фото
  const [showCropModal, setShowCropModal] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [cropTarget, setCropTarget] = useState<'new' | 'edit'>('new');
  const [cropZoom, setCropZoom] = useState(1.0);
  const [cropDrag, setCropDrag] = useState({ x: 0, y: 0 });
  const [isDraggingCrop, setIsDraggingCrop] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageNaturalSize, setImageNaturalSize] = useState({ w: 0, h: 0 });

  // Состояние для редактирования товара в модальном окне
  const [editingPart, setEditingPart] = useState<Part | null>(null);
  const [editName, setEditName] = useState('');
  const [editArticle, setEditArticle] = useState('');
  const [editPriceUZS, setEditPriceUZS] = useState('0');
  const [editPriceUSD, setEditPriceUSD] = useState('0');
  const [editQuantity, setEditQuantity] = useState('0');
  const [editDescription, setEditDescription] = useState('');
  
  // Управление существующими и новыми фото в режиме редактирования
  const [editExistingImageUrls, setEditExistingImageUrls] = useState<string[]>([]);
  const [editNewImageFiles, setEditNewImageFiles] = useState<File[]>([]);
  const [editNewImagePreviews, setEditNewImagePreviews] = useState<string[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  // Состояния для быстрого inline-редактирования цен и количества
  const [tempPricesUZS, setTempPricesUZS] = useState<{ [key: string]: string }>({});
  const [tempPricesUSD, setTempPricesUSD] = useState<{ [key: string]: string }>({});
  const [tempQuantities, setTempQuantities] = useState<{ [key: string]: string }>({});

  const router = useRouter();

  // Проверка сессии при загрузке страницы
  useEffect(() => {
    const checkAuth = () => {
      const storedAdmin = localStorage.getItem('admin_username');
      const storedRole = localStorage.getItem('admin_role') || '';
      if (!storedAdmin) {
        router.replace('/admin/login');
      } else if (storedRole !== 'admin' && storedRole !== 'manager') {
        // Доступ только для Администратора и Менеджера склада
        router.replace('/');
      } else {
        setAdminName(storedAdmin);
        setAdminRole(storedRole);
        fetchParts();
        if (storedRole === 'admin') {
          fetchAdmins();
        }
        fetchWriteOffs();
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
    } catch (err: any) {
      console.error('Ошибка загрузки сотрудников:', err);
    }
  };

  // Загрузка списка деталей (загружаем всё один раз для живого поиска)
  const fetchParts = async () => {
    try {
      setPartsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('parts')
        .select('*')
        .order('name', { ascending: true });

      if (fetchError) {
        throw fetchError;
      }

      const list = (data || []).map((part: any) => ({
        ...part,
        price_uzs: part.price_uzs ?? part.price ?? 0,
        price_usd: part.price_usd ?? 0,
        image_urls: part.image_urls ?? (part.image_url ? [part.image_url] : [])
      })) as Part[];

      setParts(list);

      // Синхронизируем временные поля для быстрого редактирования
      const pricesUZS: { [key: string]: string } = {};
      const pricesUSD: { [key: string]: string } = {};
      const quantities: { [key: string]: string } = {};
      list.forEach((part: Part) => {
        pricesUZS[part.id] = (part.price_uzs ?? 0).toString();
        pricesUSD[part.id] = (part.price_usd ?? 0).toString();
        quantities[part.id] = (part.quantity ?? 0).toString();
      });
      setTempPricesUZS(pricesUZS);
      setTempPricesUSD(pricesUSD);
      setTempQuantities(quantities);
    } catch (err: any) {
      console.error('Ошибка загрузки данных:', err);
      setError('Не удалось загрузить данные со склада. Проверьте интернет-соединение.');
    } finally {
      setPartsLoading(false);
    }
  };

  // Загрузка журнала списаний
  const fetchWriteOffs = async () => {
    try {
      setWriteoffsLoading(true);
      const { data, error: fetchErr } = await supabase
        .from('write_offs')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchErr) throw fetchErr;
      setWriteoffs(data || []);
    } catch (err: any) {
      console.error('Ошибка загрузки списаний:', err);
    } finally {
      setWriteoffsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_username');
    localStorage.removeItem('admin_role');
    router.replace('/admin/login');
  };

  // Определение устройства
  const getDeviceName = () => {
    if (typeof window === 'undefined') return 'Устройство';
    const ua = window.navigator.userAgent;
    if (/iphone/i.test(ua)) return 'iPhone';
    if (/ipad/i.test(ua)) return 'iPad';
    if (/android/i.test(ua)) {
      if (/mobile/i.test(ua)) return 'Android Phone';
      return 'Android Tablet';
    }
    if (/macintosh|mac os x/i.test(ua)) return 'Mac';
    if (/windows/i.test(ua)) return 'Windows PC';
    if (/linux/i.test(ua)) return 'Linux PC';
    return 'Устройство';
  };

  // Обработка выбора файла для обрезки
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, target: 'new' | 'edit') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setCropImageSrc(reader.result as string);
      setCropTarget(target);
      setCropZoom(1.0);
      setCropDrag({ x: 0, y: 0 });
      setShowCropModal(true);
    };
    reader.readAsDataURL(file);

    // Сбрасываем значение инпута, чтобы можно было выбрать тот же файл повторно
    e.target.value = '';
  };

  const handleImageLoaded = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImageNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDraggingCrop(true);
    setDragStart({ x: e.clientX - cropDrag.x, y: e.clientY - cropDrag.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingCrop) return;
    setCropDrag({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDraggingCrop(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDraggingCrop(true);
      setDragStart({
        x: e.touches[0].clientX - cropDrag.x,
        y: e.touches[0].clientY - dragStart.y
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingCrop || e.touches.length !== 1) return;
    setCropDrag({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y
    });
  };

  const handleTouchEnd = () => {
    setIsDraggingCrop(false);
  };

  const handleApplyCrop = () => {
    if (!cropImageSrc || imageNaturalSize.w === 0) return;

    const img = new Image();
    img.src = cropImageSrc;
    img.onload = () => {
      const containerW = 360;
      const containerH = 270;
      const cutoutW = 320;
      const cutoutH = 240;
      const cutoutX = (containerW - cutoutW) / 2;
      const cutoutY = (containerH - cutoutH) / 2;

      const displayScale = Math.min(containerW / imageNaturalSize.w, containerH / imageNaturalSize.h);
      const renderedW = imageNaturalSize.w * displayScale;
      const renderedH = imageNaturalSize.h * displayScale;

      const centerX = containerW / 2;
      const centerY = containerH / 2;

      const left = centerX - (renderedW * cropZoom) / 2 + cropDrag.x;
      const top = centerY - (renderedH * cropZoom) / 2 + cropDrag.y;

      const relativeX = cutoutX - left;
      const relativeY = cutoutY - top;

      const scaleFactor = imageNaturalSize.w / (renderedW * cropZoom);

      const srcX = relativeX * scaleFactor;
      const srcY = relativeY * scaleFactor;
      const srcW = cutoutW * scaleFactor;
      const srcH = cutoutH * scaleFactor;

      const canvas = document.createElement('canvas');
      canvas.width = cutoutW * 2;
      canvas.height = cutoutH * 2;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(
          img,
          srcX, srcY, srcW, srcH,
          0, 0, canvas.width, canvas.height
        );
      }

      canvas.toBlob((blob) => {
        if (blob) {
          const croppedFile = new File([blob], `part_${Date.now()}.jpg`, { type: 'image/jpeg' });
          const previewUrl = URL.createObjectURL(blob);
          
          if (cropTarget === 'new') {
            setNewImageFiles((prev) => [...prev, croppedFile]);
            setNewImagePreviews((prev) => [...prev, previewUrl]);
          } else {
            setEditNewImageFiles((prev) => [...prev, croppedFile]);
            setEditNewImagePreviews((prev) => [...prev, previewUrl]);
          }
        }
        setShowCropModal(false);
      }, 'image/jpeg', 0.85);
    };
  };

  // Загрузка изображения в Supabase Storage
  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
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

      const { data: urlData } = supabase.storage
        .from('part-images')
        .getPublicUrl(filePath);

      return urlData.publicUrl;
    } catch (err: any) {
      console.error('Ошибка загрузки файла в хранилище:', err);
      alert('Не удалось сохранить фотографию. Пожалуйста, проверьте соединение с интернетом или настройки хранилища.');
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
          role: newAdminRole,
        },
      ]);

      if (insertError) throw insertError;

      alert(`Сотрудник "${newAdminUsername}" успешно создан!`);
      setNewAdminUsername('');
      setNewAdminPassword('');
      setNewAdminRole('employee');
      fetchAdmins();
    } catch (err: any) {
      console.error('Ошибка при добавлении сотрудника:', err);
      alert('Не удалось добавить сотрудника. Возможно, имя уже занято или отсутствует интернет-связь.');
    } finally {
      setAddingAdmin(false);
    }
  };

  // Удаление сотрудника
  const handleDeleteAdmin = async (id: string, username: string) => {
    if (!confirm(`Вы действительно хотите удалить сотрудника "${username}"?`)) {
      return;
    }

    try {
      const { error: deleteError } = await supabase.from('admins').delete().eq('id', id);
      if (deleteError) throw deleteError;
      alert(`Доступы сотрудника "${username}" удалены.`);
      fetchAdmins();
    } catch (err: any) {
      console.error('Ошибка удаления сотрудника:', err);
      alert('Не удалось удалить сотрудника. Проверьте подключение к интернету.');
    }
  };

  // Добавление новой детали
  const handleAddPart = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingPart(true);
    setError(null);
    setSuccessMessage(null);

    const priceUzsNum = parseFloat(newPriceUZS);
    const priceUsdNum = parseFloat(newPriceUSD);
    const qtyNum = parseInt(newQuantity, 10);

    if (isNaN(priceUzsNum) || priceUzsNum < 0 || isNaN(priceUsdNum) || priceUsdNum < 0) {
      setError('Пожалуйста, введите корректные цены.');
      setAddingPart(false);
      return;
    }

    if (isNaN(qtyNum) || qtyNum < 0) {
      setError('Пожалуйста, введите корректное количество.');
      setAddingPart(false);
      return;
    }

    try {
      // Загружаем все обрезанные фото из очереди
      const uploadedUrls: string[] = [];
      for (const file of newImageFiles) {
        const url = await uploadImage(file);
        if (url) {
          uploadedUrls.push(url);
        }
      }

      let finalArticle = newArticle.trim();
      if (!finalArticle) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let autoArt = 'ART-';
        for (let i = 0; i < 6; i++) {
          autoArt += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        finalArticle = autoArt;
      }

      const { error: insertError } = await supabase.from('parts').insert([
        {
          name: newName.trim(),
          article: finalArticle,
          price_uzs: priceUzsNum,
          price_usd: priceUsdNum,
          quantity: qtyNum,
          description: newDescription.trim() || null,
          image_urls: uploadedUrls,
        },
      ]);

      if (insertError) {
        throw insertError;
      }

      setSuccessMessage(`Запчасть "${newName}" успешно добавлена на склад!`);
      
      // Очистка формы
      setNewName('');
      setNewArticle('');
      setNewPriceUZS('0');
      setNewPriceUSD('0');
      setNewQuantity('0');
      setNewDescription('');
      setNewImageFiles([]);
      setNewImagePreviews([]);

      // Перезагрузка списка деталей
      fetchParts();
    } catch (err: any) {
      console.error('Ошибка добавления детали:', err);
      setError('Не удалось добавить деталь на склад. Пожалуйста, проверьте введённые данные или интернет-соединение.');
    } finally {
      setAddingPart(false);
    }
  };

  // Открытие модального окна для редактирования детали
  const openEditModal = (part: Part) => {
    setEditingPart(part);
    setEditName(part.name);
    setEditArticle(part.article);
    setEditPriceUZS((part.price_uzs ?? 0).toString());
    setEditPriceUSD((part.price_usd ?? 0).toString());
    setEditQuantity((part.quantity ?? 0).toString());
    setEditDescription(part.description || '');
    
    // Инициализация фото
    setEditExistingImageUrls(part.image_urls || []);
    setEditNewImageFiles([]);
    setEditNewImagePreviews([]);
  };

  // Сохранение изменений из модального окна
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPart) return;

    setSavingEdit(true);
    setError(null);
    setSuccessMessage(null);

    const priceUzsNum = parseFloat(editPriceUZS);
    const priceUsdNum = parseFloat(editPriceUSD);
    const qtyNum = parseInt(editQuantity, 10);

    if (isNaN(priceUzsNum) || priceUzsNum < 0 || isNaN(priceUsdNum) || priceUsdNum < 0) {
      setError('Введите корректные цены.');
      setSavingEdit(false);
      return;
    }

    if (isNaN(qtyNum) || qtyNum < 0) {
      setError('Введите корректное количество.');
      setSavingEdit(false);
      return;
    }

    try {
      // Загружаем новые добавленные фотографии
      const uploadedUrls: string[] = [];
      for (const file of editNewImageFiles) {
        const url = await uploadImage(file);
        if (url) {
          uploadedUrls.push(url);
        }
      }

      // Объединяем оставшиеся существующие и новые фотографии
      const finalImageUrls = [...editExistingImageUrls, ...uploadedUrls];

      const { error: updateError } = await supabase
        .from('parts')
        .update({
          name: editName.trim(),
          article: editArticle.trim(),
          price_uzs: priceUzsNum,
          price_usd: priceUsdNum,
          quantity: qtyNum,
          description: editDescription.trim() || null,
          image_urls: finalImageUrls,
        })
        .eq('id', editingPart.id);

      if (updateError) {
        throw updateError;
      }

      setSuccessMessage(`Данные запчасти "${editName}" сохранены!`);
      setEditingPart(null);
      fetchParts();
    } catch (err: any) {
      console.error('Ошибка обновления детали:', err);
      setError('Не удалось сохранить изменения. Пожалуйста, проверьте введённые данные или интернет-соединение.');
    } finally {
      setSavingEdit(false);
    }
  };

  // Быстрое изменение цены (inline)
  const handleQuickPriceSave = async (id: string, name: string) => {
    const rawValUZS = tempPricesUZS[id];
    const rawValUSD = tempPricesUSD[id];
    const priceUzsNum = parseFloat(rawValUZS);
    const priceUsdNum = parseFloat(rawValUSD);

    if (isNaN(priceUzsNum) || priceUzsNum < 0 || isNaN(priceUsdNum) || priceUsdNum < 0) {
      alert('Введите корректные цены.');
      return;
    }

    try {
      const { error: updateError } = await supabase
        .from('parts')
        .update({
          price_uzs: priceUzsNum,
          price_usd: priceUsdNum
        })
        .eq('id', id);

      if (updateError) {
        throw updateError;
      }

      // Обновляем локальное состояние, чтобы отобразить сохраненное значение
      setParts(parts.map((p) => (p.id === id ? { ...p, price_uzs: priceUzsNum, price_usd: priceUsdNum } : p)));
      alert(`Цены для "${name}" успешно обновлены.`);
    } catch (err: any) {
      console.error('Ошибка быстрого сохранения цены:', err);
      alert('Не удалось обновить цены. Пожалуйста, проверьте интернет-соединение.');
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
      alert('Не удалось обновить количество товара. Пожалуйста, проверьте интернет-соединение.');
    }
  };

  // Инициация списания через модалку
  const handleOpenWriteOffModal = (part: Part) => {
    setWriteOffPart(part);
    setWriteOffQty('1');
    setWriteOffComment('');
    setWriteOffBy(adminName);
    setShowWriteOffModal(true);
  };

  // Проведение списания
  const handlePerformWriteOff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!writeOffPart) return;

    const qtyToSubtract = parseInt(writeOffQty, 10);
    if (isNaN(qtyToSubtract) || qtyToSubtract <= 0) {
      alert('Введите корректное количество для списания.');
      return;
    }

    if (qtyToSubtract > writeOffPart.quantity) {
      alert(`Недостаточно товара на складе. Доступно для списания: ${writeOffPart.quantity} шт.`);
      return;
    }

    if (!writeOffComment.trim()) {
      alert('Пожалуйста, укажите причину списания детали (комментарий).');
      return;
    }

    try {
      setError(null);
      setSuccessMessage(null);

      // 1. Записываем в журнал списаний с обязательным комментарием и трекингом устройства
      const { error: logError } = await supabase.from('write_offs').insert([
        {
          part_id: writeOffPart.id,
          part_name: writeOffPart.name,
          part_article: writeOffPart.article,
          quantity: qtyToSubtract,
          comment: writeOffComment.trim(),
          created_by: writeOffBy.trim() || 'Администратор',
          device: getDeviceName(),
        },
      ]);

      if (logError) throw logError;

      // 2. Списываем количество
      const newQty = writeOffPart.quantity - qtyToSubtract;
      const { error: updateError } = await supabase
        .from('parts')
        .update({ quantity: newQty })
        .eq('id', writeOffPart.id);

      if (updateError) throw updateError;

      setSuccessMessage(`Списано ${qtyToSubtract} шт. детали "${writeOffPart.name}"`);
      setShowWriteOffModal(false);

      // 3. Перезагружаем списки
      fetchParts();
      fetchWriteOffs();
    } catch (err: any) {
      console.error('Ошибка при списании:', err);
      alert('Не удалось провести списание. Проверьте интернет-соединение.');
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
      fetchParts();
    } catch (err: any) {
      console.error('Ошибка удаления детали:', err);
      setError('Не удалось удалить деталь со склада. Проверьте подключение к интернету.');
    }
  };

  // Мгновенная фильтрация списка запчастей в админке по мере ввода (как на главной)
  const filteredParts = parts.filter((part) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      part.name.toLowerCase().includes(q) ||
      part.article.toLowerCase().includes(q) ||
      (part.description && part.description.toLowerCase().includes(q))
    );
  });

  if (authLoading) {
    return <div className="loading-spinner">Проверка прав доступа...</div>;
  }

  // Получить первую картинку для таблицы превью
  const getFirstPartImage = (part: Part) => {
    if (part.image_urls && part.image_urls.length > 0) {
      return part.image_urls[0];
    }
    return null;
  };

  return (
    <div>
      {/* Шапка админки */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h1 style={{ fontSize: '32px' }}>Панель управления складом</h1>
          <p style={{ color: 'var(--text-muted)' }}>Сотрудник: <strong>{adminName}</strong></p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {adminRole === 'admin' && (
            <button onClick={() => setShowAdminsModal(true)} className="btn btn-secondary">
              👥 Доступы сотрудников
            </button>
          )}
          <button onClick={handleLogout} className="btn btn-danger">
            🚪 Выйти
          </button>
        </div>
      </div>

      {/* Вкладки навигации */}
      <div style={{ display: 'flex', gap: '15px', borderBottom: '2px solid var(--border)', marginBottom: '25px', paddingBottom: '2px' }}>
        <button
          onClick={() => setActiveTab('parts')}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '18px',
            fontWeight: activeTab === 'parts' ? 'bold' : 'normal',
            color: activeTab === 'parts' ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: activeTab === 'parts' ? '3px solid var(--primary)' : '3px solid transparent',
            padding: '10px 15px',
            cursor: 'pointer',
            marginBottom: '-5px',
            transition: 'all 0.15s ease',
          }}
        >
          📋 Наличие запчастей
        </button>
        <button
          onClick={() => setActiveTab('writeoffs')}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '18px',
            fontWeight: activeTab === 'writeoffs' ? 'bold' : 'normal',
            color: activeTab === 'writeoffs' ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: activeTab === 'writeoffs' ? '3px solid var(--primary)' : '3px solid transparent',
            padding: '10px 15px',
            cursor: 'pointer',
            marginBottom: '-5px',
            transition: 'all 0.15s ease',
          }}
        >
          📝 Журнал списаний
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {successMessage && <div className="alert alert-success">{successMessage}</div>}

      {/* Содержимое вкладок */}
      {activeTab === 'parts' ? (
        <div className="admin-grid">
          {/* Левая часть: Список товаров и Живой поиск */}
          <div className="admin-list-container">
            <div className="search-container" style={{ padding: '16px 20px', marginBottom: '20px' }}>
              <div className="search-box">
                <input
                  type="text"
                  className="input-field search-input"
                  style={{ width: '100%', fontSize: '16px', padding: '10px 15px' }}
                  placeholder="Введите название детали или артикул..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {partsLoading ? (
              <div className="loading-spinner">Загрузка товаров...</div>
            ) : filteredParts.length === 0 ? (
              <div className="no-results">Склад пуст или ничего не найдено.</div>
            ) : (
              <>
                {/* Таблица запчастей для ПК */}
                <div className="table-wrapper">
                  <table className="parts-table" style={{ fontSize: '16px' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '70px' }}>Фото</th>
                        <th>Артикул</th>
                        <th>Название</th>
                        <th style={{ minWidth: '150px' }}>Цена</th>
                        <th>Количество</th>
                        <th>Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredParts.map((part) => {
                        const firstImg = getFirstPartImage(part);
                        const isPriceChanged = 
                          tempPricesUZS[part.id] !== (part.price_uzs ?? 0).toString() ||
                          tempPricesUSD[part.id] !== (part.price_usd ?? 0).toString();

                        return (
                          <tr key={part.id}>
                            {/* Фото детали */}
                            <td>
                              {firstImg ? (
                                <div style={{ position: 'relative', width: '40px', height: '40px' }}>
                                  <img
                                    src={firstImg}
                                    alt={part.name}
                                    style={{
                                      width: '100%',
                                      height: '100%',
                                      objectFit: 'cover',
                                      borderRadius: '4px',
                                      border: '1px solid var(--border)',
                                    }}
                                  />
                                  {part.image_urls && part.image_urls.length > 1 && (
                                    <span style={{
                                      position: 'absolute',
                                      bottom: '-4px',
                                      right: '-4px',
                                      backgroundColor: 'var(--primary)',
                                      color: 'white',
                                      fontSize: '9px',
                                      padding: '1px 3px',
                                      borderRadius: '3px',
                                      fontWeight: 'bold'
                                    }}>
                                      +{part.image_urls.length - 1}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div style={{ width: '40px', height: '40px', backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', color: 'var(--text-muted)', border: '1px dashed var(--border)' }}>
                                  📷
                                </div>
                              )}
                            </td>
                            {/* Артикул */}
                            <td>
                              <strong style={{ fontFamily: 'monospace', fontSize: '18px' }}>{part.article}</strong>
                            </td>
                            {/* Название */}
                            <td>
                              <strong style={{ display: 'block' }}>{part.name}</strong>
                            </td>
                            {/* Inline Цена (Двойная) */}
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                  <input
                                    type="number"
                                    className="quick-edit-input"
                                    value={tempPricesUZS[part.id] || ''}
                                    onChange={(e) => setTempPricesUZS({ ...tempPricesUZS, [part.id]: e.target.value })}
                                    style={{ width: '90px', padding: '3px 6px' }}
                                  />
                                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>сум</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                  <input
                                    type="number"
                                    step="0.01"
                                    className="quick-edit-input"
                                    value={tempPricesUSD[part.id] || ''}
                                    onChange={(e) => setTempPricesUSD({ ...tempPricesUSD, [part.id]: e.target.value })}
                                    style={{ width: '90px', padding: '3px 6px' }}
                                  />
                                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>$</span>
                                </div>
                                <button
                                  onClick={() => handleQuickPriceSave(part.id, part.name)}
                                  className={`btn btn-sm ${isPriceChanged ? 'btn-primary' : 'btn-secondary'}`}
                                  style={{ minHeight: 'auto', padding: '2px 8px', fontSize: '12px', width: 'fit-content' }}
                                >
                                  Сохранить
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
                                  onClick={() => handleOpenWriteOffModal(part)}
                                  className="btn btn-sm"
                                  style={{ minHeight: 'auto', backgroundColor: '#f59e0b', color: 'white', border: 'none' }}
                                  disabled={part.quantity <= 0}
                                  title="Списания..."
                                >
                                  Списать
                                </button>
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
                  {filteredParts.map((part) => {
                    const firstImg = getFirstPartImage(part);
                    return (
                      <div key={part.id} className="part-card">
                        {firstImg && (
                          <div style={{ width: '100%', height: '140px', overflow: 'hidden', borderRadius: '6px', border: '1px solid var(--border)', marginBottom: '12px' }}>
                            <img src={firstImg} alt={part.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                        )}
                        <div className="part-card-title">{part.name}</div>
                        <div className="part-card-row">
                          <span className="part-card-label">Артикул:</span>
                          <span className="part-card-value" style={{ fontFamily: 'monospace' }}>{part.article}</span>
                        </div>
                        
                        {/* Двойная цена для мобильных */}
                        <div className="part-card-row" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: '6px' }}>
                          <span className="part-card-label" style={{ marginBottom: '2px' }}>Цена:</span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <input
                                type="number"
                                className="quick-edit-input"
                                value={tempPricesUZS[part.id] || ''}
                                onChange={(e) => setTempPricesUZS({ ...tempPricesUZS, [part.id]: e.target.value })}
                                style={{ width: '100px' }}
                              />
                              <span style={{ fontSize: '13px' }}>сум</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <input
                                type="number"
                                step="0.01"
                                className="quick-edit-input"
                                value={tempPricesUSD[part.id] || ''}
                                onChange={(e) => setTempPricesUSD({ ...tempPricesUSD, [part.id]: e.target.value })}
                                style={{ width: '100px' }}
                              />
                              <span style={{ fontSize: '13px' }}>$</span>
                            </div>
                            <button
                              onClick={() => handleQuickPriceSave(part.id, part.name)}
                              className="btn btn-sm btn-primary"
                              style={{ minHeight: 'auto', padding: '6px 12px', width: 'fit-content' }}
                            >
                              Сохранить цены
                            </button>
                          </div>
                        </div>

                        {/* Inline количество для мобильных */}
                        <div className="part-card-row" style={{ alignItems: 'center', marginTop: '10px' }}>
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

                        <div style={{ display: 'flex', gap: '10px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
                          <button
                            onClick={() => handleOpenWriteOffModal(part)}
                            className="btn btn-sm"
                            style={{ flexGrow: 1, minHeight: '40px', backgroundColor: '#f59e0b', color: 'white', border: 'none' }}
                            disabled={part.quantity <= 0}
                          >
                            Списать...
                          </button>
                          <button
                            onClick={() => openEditModal(part)}
                            className="btn btn-sm btn-secondary"
                            style={{ flexGrow: 1, minHeight: '40px' }}
                          >
                            Изменить
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
                    );
                  })}
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
                  <label className="input-label" style={{ fontSize: '16px' }}>Артикул (номер детали)</label>
                  <input
                    type="text"
                    className="input-field"
                    style={{ padding: '8px 12px', fontSize: '16px' }}
                    placeholder="Оставьте пустым для автогенерации"
                    value={newArticle}
                    onChange={(e) => setNewArticle(e.target.value)}
                  />
                </div>

                <div className="input-group">
                  <label className="input-label" style={{ fontSize: '16px' }}>Название запчасти *</label>
                  <input
                    type="text"
                    className="input-field"
                    style={{ padding: '8px 12px', fontSize: '16px' }}
                    placeholder="Название детали"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="input-group">
                    <label className="input-label" style={{ fontSize: '16px' }}>Цена в сумах *</label>
                    <input
                      type="number"
                      className="input-field"
                      style={{ padding: '8px 12px', fontSize: '16px' }}
                      value={newPriceUZS}
                      onChange={(e) => setNewPriceUZS(e.target.value)}
                      required
                    />
                  </div>

                  <div className="input-group">
                    <label className="input-label" style={{ fontSize: '16px' }}>Цена в USD ($) *</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input-field"
                      style={{ padding: '8px 12px', fontSize: '16px' }}
                      value={newPriceUSD}
                      onChange={(e) => setNewPriceUSD(e.target.value)}
                      required
                    />
                  </div>
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

                <div className="input-group">
                  <label className="input-label" style={{ fontSize: '16px' }}>Описание / Применяемость</label>
                  <textarea
                    className="input-field"
                    style={{ padding: '8px 12px', fontSize: '16px', minHeight: '80px', fontFamily: 'inherit' }}
                    placeholder="Применяемость, описание или характеристики"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                  />
                </div>

                {/* Очередь загрузки фотографий */}
                <div className="input-group">
                  <label className="input-label" style={{ fontSize: '16px' }}>Фотографии запчасти</label>
                  
                  {newImagePreviews.length > 0 && (
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px', border: '1px solid var(--border)', padding: '10px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.01)' }}>
                      {newImagePreviews.map((url, idx) => (
                        <div key={idx} style={{ position: 'relative', width: '64px', height: '48px' }}>
                          <img
                            src={url}
                            alt={`new-preview-${idx}`}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border)' }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setNewImageFiles(newImageFiles.filter((_, i) => i !== idx));
                              setNewImagePreviews(newImagePreviews.filter((_, i) => i !== idx));
                            }}
                            style={{
                              position: 'absolute',
                              top: '-6px',
                              right: '-6px',
                              backgroundColor: 'var(--danger)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '50%',
                              width: '18px',
                              height: '18px',
                              fontSize: '11px',
                              lineHeight: '18px',
                              textAlign: 'center',
                              cursor: 'pointer',
                              padding: 0,
                              fontWeight: 'bold'
                            }}
                          >
                            &times;
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <input
                    id="new-part-image"
                    type="file"
                    accept="image/*"
                    className="input-field"
                    style={{ padding: '8px 12px', fontSize: '15px' }}
                    onChange={(e) => handleFileSelect(e, 'new')}
                  />
                  <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                    Вы можете выбрать и обрезать несколько изображений по очереди.
                  </small>
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
      ) : (
        /* Вкладка: Журнал списаний */
        <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', boxShadow: 'var(--shadow-md)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
            <h3 style={{ fontSize: '22px', margin: 0 }}>История списаний запчастей</h3>
            <button onClick={fetchWriteOffs} className="btn btn-secondary btn-sm" style={{ minHeight: '34px' }}>
              🔄 Обновить журнал
            </button>
          </div>

          {writeoffsLoading ? (
            <div className="loading-spinner">Загрузка журнала списаний...</div>
          ) : writeoffs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-muted)' }}>
              <p style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '5px' }}>Журнал списаний пуст</p>
              <p>Здесь будут отображаться списанные со склада запчасти с комментариями.</p>
            </div>
          ) : (
            <div className="table-wrapper" style={{ margin: 0, border: 'none', boxShadow: 'none', overflowX: 'auto' }}>
              <table className="parts-table" style={{ fontSize: '15px', width: '100%' }}>
                <thead>
                  <tr>
                    <th>Дата / Время</th>
                    <th>Запчасть / Артикул</th>
                    <th>Кол-во</th>
                    <th>Причина / На что списано</th>
                    <th>Устройство</th>
                    <th>Кто списал</th>
                  </tr>
                </thead>
                <tbody>
                  {writeoffs.map((item) => {
                    const formattedDate = new Date(item.created_at).toLocaleString('ru-RU', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                    return (
                      <tr key={item.id}>
                        <td style={{ color: 'var(--text-muted)', fontSize: '14px', whiteSpace: 'nowrap' }}>
                          {formattedDate}
                        </td>
                        <td>
                          <strong style={{ fontSize: '16px', display: 'block' }}>{item.part_name}</strong>
                          <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            {item.part_article}
                          </span>
                        </td>
                        <td style={{ fontWeight: 'bold', color: 'var(--danger)', fontSize: '17px', whiteSpace: 'nowrap' }}>
                          -{item.quantity} шт.
                        </td>
                        <td style={{ fontStyle: item.comment ? 'normal' : 'italic', color: item.comment ? 'inherit' : 'var(--text-muted)' }}>
                          {item.comment || 'комментарий отсутствует'}
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                          {item.device || 'Неизвестно'}
                        </td>
                        <td style={{ fontWeight: '600' }}>{item.created_by}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Модальное окно редактирования запчасти (редактировать всё) */}
      {editingPart && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '550px' }}>
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
                   <label className="input-label">Цена в сумах *</label>
                  <input
                    type="number"
                    className="input-field"
                    value={editPriceUZS}
                    onChange={(e) => setEditPriceUZS(e.target.value)}
                    required
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Цена в USD ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input-field"
                    value={editPriceUSD}
                    onChange={(e) => setEditPriceUSD(e.target.value)}
                    required
                  />
                </div>
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

              <div className="input-group">
                <label className="input-label">Описание / Применяемость</label>
                <textarea
                  className="input-field"
                  style={{ minHeight: '100px', fontFamily: 'inherit' }}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                />
              </div>

              {/* Управление галереей фотографий при редактировании */}
              <div className="input-group">
                <label className="input-label">Фотографии запчасти</label>
                
                {/* Существующие и новые фотографии */}
                {(editExistingImageUrls.length > 0 || editNewImagePreviews.length > 0) && (
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px', border: '1px solid var(--border)', padding: '10px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.01)' }}>
                    {/* Список существующих */}
                    {editExistingImageUrls.map((url, idx) => (
                      <div key={`existing-${idx}`} style={{ position: 'relative', width: '64px', height: '48px' }}>
                        <img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border)' }} />
                        <button
                          type="button"
                          onClick={() => setEditExistingImageUrls(editExistingImageUrls.filter((_, i) => i !== idx))}
                          style={{
                            position: 'absolute',
                            top: '-6px',
                            right: '-6px',
                            backgroundColor: 'var(--danger)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '50%',
                            width: '18px',
                            height: '18px',
                            fontSize: '11px',
                            lineHeight: '18px',
                            cursor: 'pointer',
                            padding: 0,
                            fontWeight: 'bold'
                          }}
                          title="Удалить это фото"
                        >
                          &times;
                        </button>
                      </div>
                    ))}

                    {/* Список новых */}
                    {editNewImagePreviews.map((url, idx) => (
                      <div key={`new-${idx}`} style={{ position: 'relative', width: '64px', height: '48px' }}>
                        <img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border)', opacity: 0.8 }} />
                        <button
                          type="button"
                          onClick={() => {
                            setEditNewImageFiles(editNewImageFiles.filter((_, i) => i !== idx));
                            setEditNewImagePreviews(editNewImagePreviews.filter((_, i) => i !== idx));
                          }}
                          style={{
                            position: 'absolute',
                            top: '-6px',
                            right: '-6px',
                            backgroundColor: 'var(--danger)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '50%',
                            width: '18px',
                            height: '18px',
                            fontSize: '11px',
                            lineHeight: '18px',
                            cursor: 'pointer',
                            padding: 0,
                            fontWeight: 'bold'
                          }}
                          title="Отменить добавление"
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <input
                  type="file"
                  accept="image/*"
                  className="input-field"
                  style={{ padding: '8px 12px', fontSize: '15px' }}
                  onChange={(e) => handleFileSelect(e, 'edit')}
                />
                <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                  Вы можете добавить еще обрезанные изображения.
                </small>
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

      {/* Модальное окно проведения списания детали */}
      {showWriteOffModal && writeOffPart && (
        <div className="modal-overlay" style={{ zIndex: 1900 }}>
          <div className="modal-content" style={{ maxWidth: '450px', padding: '24px' }}>
            <div className="modal-header">
              <span className="modal-title">Списание запчасти</span>
              <button onClick={() => setShowWriteOffModal(false)} className="modal-close">
                &times;
              </button>
            </div>

            <div style={{ marginBottom: '20px', padding: '12px', backgroundColor: 'rgba(0,0,0,0.01)', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>Деталь для списания:</p>
              <strong style={{ fontSize: '16px', display: 'block', marginBottom: '4px' }}>{writeOffPart.name}</strong>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'monospace', display: 'block' }}>
                Артикул: {writeOffPart.article}
              </span>
              <span style={{ fontSize: '14px', marginTop: '8px', display: 'block', fontWeight: 'bold' }}>
                Доступно на складе: {writeOffPart.quantity} шт.
              </span>
            </div>

            <form onSubmit={handlePerformWriteOff}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div className="input-group">
                  <label className="input-label">Кол-во списания *</label>
                  <input
                    type="number"
                    min="1"
                    max={writeOffPart.quantity}
                    className="input-field"
                    value={writeOffQty}
                    onChange={(e) => setWriteOffQty(e.target.value)}
                    required
                  />
                </div>
                
                <div className="input-group">
                  <label className="input-label">Кто списал</label>
                  <input
                    type="text"
                    className="input-field"
                    value={writeOffBy}
                    disabled
                    style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed' }}
                  />
                </div>
              </div>

              <div className="input-group" style={{ marginBottom: '15px' }}>
                <label className="input-label">Устройство фиксации</label>
                <input
                  type="text"
                  className="input-field"
                  value={getDeviceName()}
                  disabled
                  style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed' }}
                />
              </div>

              <div className="input-group" style={{ marginBottom: '20px' }}>
                <label className="input-label">Причина / На что списано *</label>
                <textarea
                  className="input-field"
                  placeholder="Обязательно укажите причину списания детали..."
                  style={{ minHeight: '80px', fontFamily: 'inherit', padding: '8px 12px' }}
                  value={writeOffComment}
                  onChange={(e) => setWriteOffComment(e.target.value)}
                  required
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setShowWriteOffModal(false)}
                  className="btn btn-secondary"
                  style={{ minHeight: '40px' }}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="btn btn-danger"
                  style={{ minHeight: '40px', backgroundColor: '#f59e0b', borderColor: '#f59e0b', color: 'white' }}
                >
                  Подтвердить списание
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно Доступы сотрудников */}
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
                {admins.filter((adm) => adm.username !== 'Администратор').map((adm) => (
                  <div key={adm.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--card-bg)', borderRadius: '4px' }}>
                    <div style={{ display: 'flex', flexGrow: 1, justifyContent: 'space-between', alignItems: 'center', marginRight: '10px' }}>
                      <div>
                        <strong style={{ fontSize: '15px' }}>{adm.username}</strong>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                          {adm.role === 'admin' ? '(Администратор)' : adm.role === 'manager' ? '(Менеджер)' : '(Сотрудник)'}
                        </span>
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        Пароль: {adminRole === 'admin' ? adm.password : '••••••'}
                      </span>
                    </div>
                    {adminRole === 'admin' && adm.username !== 'Администратор' && adm.username !== adminName && (
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

            {adminRole === 'admin' ? (
              <form onSubmit={handleAddAdmin} style={{ borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
                <h4 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '15px' }}>Добавить сотрудника</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="input-group">
                    <label className="input-label">Имя сотрудника *</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Имя"
                      value={newAdminUsername}
                      onChange={(e) => setNewAdminUsername(e.target.value)}
                      required
                    />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Пароль для входа *</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Пароль"
                      value={newAdminPassword}
                      onChange={(e) => setNewAdminPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="input-group" style={{ marginTop: '10px' }}>
                  <label className="input-label">Роль сотрудника *</label>
                  <select
                    className="input-field"
                    value={newAdminRole}
                    onChange={(e) => setNewAdminRole(e.target.value as 'admin' | 'manager' | 'employee')}
                    style={{ padding: '8px 12px', fontSize: '16px' }}
                  >
                    <option value="employee">Обычный сотрудник (только списание с главной)</option>
                    <option value="manager">Сотрудник склада / Менеджер (доступ в админку)</option>
                    <option value="admin">Администратор (полный доступ + создание сотрудников)</option>
                  </select>
                </div>

                <div className="modal-actions" style={{ marginTop: '15px' }}>
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
            ) : (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                Добавлять сотрудников и просматривать пароли может только Администратор.
                <div style={{ marginTop: '15px' }}>
                  <button type="button" onClick={() => setShowAdminsModal(false)} className="btn btn-secondary btn-sm" style={{ padding: '8px 20px' }}>
                    Закрыть
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Модальное окно для обрезки фотографии */}
      {showCropModal && cropImageSrc && (
        <div className="modal-overlay" style={{ zIndex: 2000 }}>
          <div className="modal-content" style={{ maxWidth: '400px', padding: '20px' }}>
            <div className="modal-header">
              <span className="modal-title">Выбор области фото (4:3)</span>
              <button onClick={() => setShowCropModal(false)} className="modal-close">
                &times;
              </button>
            </div>
            
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '15px' }}>
              Перетаскивайте фото мышкой/пальцем и увеличивайте ползунком снизу, чтобы выбрать нужную область для карточки.
            </p>

            {/* Контейнер обрезки */}
            <div
              style={{
                width: '360px',
                height: '270px',
                position: 'relative',
                overflow: 'hidden',
                cursor: 'move',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                backgroundColor: '#000000',
                margin: '0 auto 15px auto',
                userSelect: 'none',
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <img
                src={cropImageSrc}
                alt="Crop preview"
                onLoad={handleImageLoaded}
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: `translate(-50%, -50%) translate(${cropDrag.x}px, ${cropDrag.y}px) scale(${cropZoom})`,
                  transformOrigin: 'center center',
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  pointerEvents: 'none',
                }}
              />
              
              {/* Рамка обрезки в центре: 320x240 */}
              <div
                style={{
                  position: 'absolute',
                  top: '15px',
                  left: '20px',
                  width: '320px',
                  height: '240px',
                  border: '2px dashed #ffffff',
                  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)',
                  pointerEvents: 'none',
                  borderRadius: '4px',
                }}
              />
            </div>

            {/* Зум ползунок */}
            <div className="input-group" style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '14px' }}>
                <span className="input-label" style={{ margin: 0 }}>Увеличение</span>
                <span style={{ fontWeight: 'bold' }}>{Math.round(cropZoom * 100)}%</span>
              </div>
              <input
                type="range"
                min="1.0"
                max="3.0"
                step="0.05"
                value={cropZoom}
                onChange={(e) => setCropZoom(parseFloat(e.target.value))}
                style={{ width: '100%', cursor: 'pointer' }}
              />
            </div>

            {/* Кнопки */}
            <div className="modal-actions">
              <button
                type="button"
                onClick={() => setShowCropModal(false)}
                className="btn btn-secondary"
                style={{ minHeight: '40px' }}
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleApplyCrop}
                className="btn btn-primary"
                style={{ minHeight: '40px' }}
              >
                Готово
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

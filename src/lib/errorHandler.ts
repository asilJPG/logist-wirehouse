/**
 * Преобразует технические ошибки сервера / базы данных в понятные
 * человеку сообщения, либо возвращает детали пользовательской ошибки.
 */
export function formatUserFriendlyError(err: any, fallbackContextMessage: string): string {
  if (!err) return fallbackContextMessage;

  // Ошибки, сгенерированные в виде простых строк
  if (typeof err === 'string') {
    return err;
  }

  const code = err.code || '';
  const message = err.message || err.details || err.hint || '';

  // 1. Ошибки ввода / валидации пользователем
  if (code === '23505' || message.includes('duplicate key') || message.includes('already exists')) {
    return 'Запись с таким названием, именем или артикулом уже существует.';
  }

  if (code === '23503' || message.includes('foreign key constraint')) {
    return 'Невозможно выполнить операцию: данная запись связана с другими элементами.';
  }

  if (code === '22P02' || message.includes('invalid input syntax')) {
    return 'Пожалуйста, проверьте введённые данные — одно из полей содержит некорректный формат.';
  }

  if (code === '42501' || message.includes('permission denied') || message.includes('row-level security')) {
    return 'У вашей учётной записи недостаточно прав для выполнения этого действия.';
  }

  // 2. Сетевые ошибки
  if (message.includes('Failed to fetch') || message.includes('NetworkError') || message.includes('Network Error')) {
    return 'Отсутствует связь с сервером. Пожалуйста, проверьте подключение к сети Интернет.';
  }

  // 3. Понятное пользовательское текстовое сообщение
  if (message && !message.includes('PGRST') && !message.includes('postgres') && !message.includes('column') && !message.includes('relation') && !message.includes('JW')) {
    return message;
  }

  // 4. Понятная общая серверная ошибка по умолчанию
  return `${fallbackContextMessage}. Пожалуйста, попробуйте ещё раз через несколько секунд.`;
}

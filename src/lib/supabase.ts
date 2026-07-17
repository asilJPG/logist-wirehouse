import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase URL or Anon Key is missing. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file.'
  );
}

// Создаем прокси, если переменные окружения отсутствуют, чтобы сборка next build не падала.
// Ошибка будет выброшена только при реальной попытке вызвать метод клиента на клиенте.
export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : (new Proxy(
        {},
        {
          get(_, prop) {
            return () => {
              throw new Error(
                `Supabase клиент вызван, но NEXT_PUBLIC_SUPABASE_URL или NEXT_PUBLIC_SUPABASE_ANON_KEY не настроены в файле .env.local.`
              );
            };
          },
        }
      ) as any);


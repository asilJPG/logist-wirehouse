-- Скрипт создания таблиц для Supabase SQL Editor
-- (Без использования Supabase Auth / без RLS для максимальной простоты настройки)

-- 1. Создание таблицы parts (запчасти)
CREATE TABLE IF NOT EXISTS public.parts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    article TEXT NOT NULL,
    brand TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    location TEXT,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Создание таблицы admins (сотрудники склада)
CREATE TABLE IF NOT EXISTS public.admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Автоматическое обновление updated_at при изменении записи parts
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_parts_updated_at
    BEFORE UPDATE ON public.parts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 4. Добавление индексов для ускорения поиска
CREATE INDEX IF NOT EXISTS parts_name_idx ON public.parts (name);
CREATE INDEX IF NOT EXISTS parts_article_idx ON public.parts (article);
CREATE INDEX IF NOT EXISTS parts_brand_idx ON public.parts (brand);

-- 5. Создание стандартного администратора (логин по паролю: 12345)
INSERT INTO public.admins (username, password)
VALUES ('Администратор', '12345')
ON CONFLICT (username) DO NOTHING;

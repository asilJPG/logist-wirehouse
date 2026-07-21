-- Скрипт создания таблиц для Supabase SQL Editor
-- (Без использования Supabase Auth / без RLS для максимальной простоты настройки)

-- 1. Создание таблицы parts (запчасти)
CREATE TABLE IF NOT EXISTS public.parts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    article TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    description TEXT,
    image_urls TEXT[] DEFAULT '{}', -- Ссылка на фотографии запчасти в Supabase Storage
    price_uzs NUMERIC(15, 2) DEFAULT 0.00,
    price_usd NUMERIC(10, 2) DEFAULT 0.00,
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

-- 3. Создание таблицы write_offs (журнал списаний запчастей)
CREATE TABLE IF NOT EXISTS public.write_offs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    part_id UUID REFERENCES public.parts(id) ON DELETE SET NULL,
    part_name TEXT NOT NULL,
    part_article TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    comment TEXT,
    created_by TEXT NOT NULL,
    device TEXT, -- Устройство, с которого произведено списание
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Обновление существующих таблиц (миграция колонок)
ALTER TABLE public.parts DROP COLUMN IF EXISTS location;
ALTER TABLE public.parts DROP COLUMN IF EXISTS brand;
ALTER TABLE public.parts DROP COLUMN IF EXISTS price;
ALTER TABLE public.parts DROP COLUMN IF EXISTS image_url;
ALTER TABLE public.parts ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT '{}';
ALTER TABLE public.parts ADD COLUMN IF NOT EXISTS price_uzs NUMERIC(15, 2) DEFAULT 0.00;
ALTER TABLE public.parts ADD COLUMN IF NOT EXISTS price_usd NUMERIC(10, 2) DEFAULT 0.00;

ALTER TABLE public.write_offs ADD COLUMN IF NOT EXISTS device TEXT;

-- Отключение RLS для новой таблицы списаний
ALTER TABLE public.write_offs DISABLE ROW LEVEL SECURITY;

-- 4. Автоматическое обновление updated_at при изменении записи parts
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_parts_updated_at ON public.parts;

CREATE TRIGGER update_parts_updated_at
    BEFORE UPDATE ON public.parts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 5. Добавление индексов для ускорения поиска
CREATE INDEX IF NOT EXISTS parts_name_idx ON public.parts (name);
CREATE INDEX IF NOT EXISTS parts_article_idx ON public.parts (article);
CREATE INDEX IF NOT EXISTS write_offs_created_at_idx ON public.write_offs (created_at DESC);

-- 6. Создание стандартного администратора (логин по паролю: 12345)
INSERT INTO public.admins (username, password)
VALUES ('Администратор', '12345')
ON CONFLICT (username) DO NOTHING;

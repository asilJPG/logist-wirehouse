import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Склад запчастей - Наличие и Поиск',
  description: 'Простая система поиска запчастей на складе для розничных и оптовых покупателей.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>
        <header className="header">
          <div className="container header-content">
            <Link href="/" className="logo">
              📦 Склад Запчастей
            </Link>
            <nav className="nav-links">
              <Link href="/admin" className="nav-link btn btn-secondary btn-sm" style={{ padding: '8px 16px', minHeight: 'auto' }}>
                🔑 Вход для сотрудников
              </Link>
            </nav>
          </div>
        </header>

        <main className="container">{children}</main>
      </body>
    </html>
  );
}

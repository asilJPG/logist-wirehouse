import type { Metadata } from 'next';
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
        <main className="container" style={{ padding: '20px' }}>
          {children}
        </main>
      </body>
    </html>
  );
}

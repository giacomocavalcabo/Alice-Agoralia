import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Alice - Agoralia Control Center',
  description: 'Centralized dashboard for Agoralia platform management',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full min-h-screen bg-[#0a0a0a] text-white antialiased">
        {children}
      </body>
    </html>
  )
}

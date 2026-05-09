import type { Metadata } from 'next'
import { Analytics } from "@vercel/analytics/react"
import { Toaster } from 'sonner'
import './globals.css'

export const metadata: Metadata = {
  title: 'TestBento | Organized QA Platform',
  description: 'A modern, scalable, role-based internal Test Management Application.',
}

/**
 * RootLayout: Wraps all pages in the application.
 * Contains the core HTML structure, global styles, and Vercel Analytics.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Render child pages/layouts */}
        {children}
        
        {/* Inject Vercel Web Analytics scripts for pageview tracking */}
        <Analytics />
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  )
}

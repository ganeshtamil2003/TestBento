'use client'

import { useState, useRef, useEffect } from 'react'
import { Download, FileText, FileSpreadsheet, File } from 'lucide-react'

interface ExportDropdownProps {
  onExportCSV?: () => void
  onExportExcel?: () => void
  onExportPDF?: () => void
}

export default function ExportDropdown({ onExportCSV, onExportExcel, onExportPDF }: ExportDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setIsOpen(true)
  }

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false)
    }, 200) // 200ms delay prevents accidental closes when jumping the gap
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  return (
    <div className="relative inline-block text-left no-print" ref={dropdownRef} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <button 
        type="button" 
        className="btn-secondary h-10 px-3 flex items-center gap-2"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Download className="w-4 h-4" />
        <span>Export</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full pt-1 w-36 z-50">
          <div className="rounded-md shadow-lg bg-card ring-1 ring-black ring-opacity-5 animate-in fade-in zoom-in-95 duration-100 border border-border overflow-hidden">
          <div className="py-1" role="menu" aria-orientation="vertical">
            {onExportCSV && (
              <button
                onClick={() => { setIsOpen(false); onExportCSV(); }}
                className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-muted flex items-center gap-2"
                role="menuitem"
              >
                <File className="w-4 h-4 text-slate-500" />
                CSV
              </button>
            )}
            {onExportExcel && (
              <button
                onClick={() => { setIsOpen(false); onExportExcel(); }}
                className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-muted flex items-center gap-2"
                role="menuitem"
              >
                <FileSpreadsheet className="w-4 h-4 text-green-600" />
                Excel
              </button>
            )}
            {onExportPDF && (
              <button
                onClick={() => { setIsOpen(false); onExportPDF(); }}
                className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-muted flex items-center gap-2"
                role="menuitem"
              >
                <FileText className="w-4 h-4 text-red-500" />
                PDF
              </button>
            )}
          </div>
          </div>
        </div>
      )}
    </div>
  )
}

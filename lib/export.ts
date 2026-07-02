import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export function exportToCSV(filename: string, data: Record<string, any>[]) {
  const ws = XLSX.utils.json_to_sheet(data)
  const csv = XLSX.utils.sheet_to_csv(ws)
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
}

export function exportToExcel(filename: string, sheetName: string, data: Record<string, any>[]) {
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`)
}

export function exportPageToPDF() {
  window.print()
}

export function exportTableToPDF(filename: string, title: string, data: Record<string, any>[]) {
  if (data.length === 0) return

  const doc = new jsPDF('landscape')
  
  doc.setFontSize(14)
  doc.text(title, 14, 15)
  
  const headers = Object.keys(data[0])
  const rows = data.map(obj => headers.map(header => obj[header] !== undefined && obj[header] !== null ? String(obj[header]) : ''))

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 20,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [79, 70, 229] }, // matches Tailwind primary indigo
  })

  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`)
}

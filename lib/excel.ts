import * as XLSX from 'xlsx'
import type { TestCase, TestStep } from '@/types'

export function getTestCasesExportData(testCases: TestCase[]) {
  return testCases.flatMap((tc) => {
    if (tc.steps.length === 0) {
      return [{
        'TC ID': tc.sequence_id ? `TC-${tc.sequence_id}` : `TC-${tc.id.slice(0, 4)}`,
        'Title': tc.title,
        'Description': tc.description || '',
        'Preconditions': tc.preconditions || '',
        'Postconditions': tc.postconditions || '',
        'Step #': '' as string | number,
        'Step Action': '',
        'Step Expected': '',
        'Overall Expected Result': tc.expected_result || '',
        'Priority': tc.priority,
        'Execution Type': tc.automation_status,
        'Status': tc.status,
      }]
    }
    return tc.steps.map((step, idx) => ({
      'TC ID': idx === 0 ? (tc.sequence_id ? `TC-${tc.sequence_id}` : `TC-${tc.id.slice(0, 4)}`) : '',
      'Title': idx === 0 ? tc.title : '',
      'Description': idx === 0 ? (tc.description || '') : '',
      'Preconditions': idx === 0 ? (tc.preconditions || '') : '',
      'Postconditions': idx === 0 ? (tc.postconditions || '') : '',
      'Step #': step.step_number as string | number,
      'Step Action': step.action,
      'Step Expected': step.expected_result,
      'Overall Expected Result': idx === 0 ? (tc.expected_result || '') : '',
      'Priority': idx === 0 ? tc.priority : '',
      'Execution Type': idx === 0 ? tc.automation_status : '',
      'Status': idx === 0 ? tc.status : '',
    }))
  })
}

export function exportTestCasesToExcel(testCases: TestCase[], filename = 'test_cases.xlsx') {
  const rows = getTestCasesExportData(testCases)
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Test Cases')
  XLSX.writeFile(wb, filename)
}

export function getImportTemplate() {
  const template = [{
    'Title': 'Login with valid credentials',
    'Description': 'Verify user can log in',
    'Preconditions': 'User must be registered',
    'Postconditions': 'User is logged in',
    'Step #': 1,
    'Step Action': 'Navigate to login page',
    'Step Expected': 'Login page is displayed',
    'Overall Expected Result': 'User is redirected to dashboard',
    'Priority': 'HIGH',
    'Execution Type': 'MANUAL',
  }]
  const ws = XLSX.utils.json_to_sheet(template)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Test Cases')
  XLSX.writeFile(wb, 'test_case_import_template.xlsx')
}

export interface ParsedTestCase {
  title: string
  description: string
  preconditions: string
  postconditions: string
  expected_result: string
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  automation_status: 'AUTOMATED' | 'MANUAL' | 'SEMI_AUTOMATED'
  steps: TestStep[]
}

export async function parseTestCasesExcel(file: File): Promise<ParsedTestCase[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: '' })

        const grouped: Map<string, ParsedTestCase> = new Map()

        for (const row of rows) {
          const title = (row['Title'] || '').trim()
          if (!title && !grouped.size) continue

          const key = title || [...grouped.keys()].at(-1) || ''

          if (!grouped.has(key) && title) {
            grouped.set(key, {
              title,
              description: row['Description'] || '',
              preconditions: row['Preconditions'] || '',
              postconditions: row['Postconditions'] || '',
              expected_result: row['Overall Expected Result'] || '',
              priority: ((['HIGH', 'MEDIUM', 'LOW'] as string[]).includes(row['Priority']) ? row['Priority'] : 'MEDIUM') as ParsedTestCase['priority'],
              automation_status: ((['AUTOMATED', 'MANUAL', 'SEMI_AUTOMATED'] as string[]).includes(row['Execution Type']) ? row['Execution Type'] : 'MANUAL') as ParsedTestCase['automation_status'],
              steps: [],
            })
          }

          const stepNum = parseInt(row['Step #'] || '0')
          const action = (row['Step Action'] || '').trim()
          if (stepNum > 0 && action && grouped.has(key)) {
            grouped.get(key)!.steps.push({
              step_number: stepNum,
              action,
              expected_result: row['Step Expected'] || '',
            })
          }
        }

        resolve([...grouped.values()])
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

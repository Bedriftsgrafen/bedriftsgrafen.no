import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { YearSelector } from '../YearSelector'
import type { Accounting } from '../../../types'

describe('YearSelector', () => {
  it('labels non-calendar fiscal years by accounting year and period', () => {
    const accountings = [
      { id: 1, aar: 2025, periode_fra: null, periode_til: null, source_id: '6335555', salgsinntekter: 19922044, aarsresultat: -3925770 },
      { id: 2, aar: 2025, periode_fra: '2024-07-01', periode_til: '2025-06-30', source_id: '6335555', salgsinntekter: 19922044, aarsresultat: -3925770 },
      { id: 3, aar: 2024, periode_fra: null, periode_til: '2024-12-31', salgsinntekter: 17142624, aarsresultat: -5017296 },
    ] as Accounting[]

    render(
      <YearSelector
        accountings={accountings}
        selectedAccountingId={2}
        onSelectAccounting={vi.fn()}
      />
    )

    expect(screen.getByText('Velg regnskapsår')).toBeInTheDocument()

    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(2)
    expect(buttons[0]).toHaveTextContent('2025')
    expect(buttons[0]).toHaveTextContent('jul 2024 - jun 2025')
    expect(buttons[0]).not.toHaveTextContent('2024/2025')
    expect(screen.getByRole('button', { name: 'Regnskapsår 2025, periode jul 2024 til jun 2025' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Regnskapsår 2024' })).toBeInTheDocument()
  })
})
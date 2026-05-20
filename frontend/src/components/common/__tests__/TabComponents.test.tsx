import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TabButton, TabContainer } from '../'

describe('TabComponents', () => {
    describe('TabButton', () => {
        it('renders label and icon', () => {
            const label = 'Test Tab'
            render(
                <TabButton
                    active={false}
                    icon={<span data-testid="icon" />}
                    label={label}
                    onClick={() => { }}
                />
            )
            expect(screen.getByText(label)).toBeDefined()
            expect(screen.getByTestId('icon')).toBeDefined()
        })

        it('calls onClick when clicked', () => {
            const onClick = vi.fn()
            render(
                <TabButton
                    active={false}
                    icon={<span />}
                    label="Click me"
                    onClick={onClick}
                />
            )
            fireEvent.click(screen.getByText('Click me'))
            expect(onClick).toHaveBeenCalled()
        })

        it('applies active styles when active', () => {
            render(
                <TabButton
                    active={true}
                    icon={<span />}
                    label="Active Tab"
                    onClick={() => { }}
                />
            )
            const button = screen.getByRole('tab', { name: 'Active Tab' })
            expect(button.className).toContain('text-blue-900')
            expect(button.className).toContain('border-blue-900')
            expect(button).toHaveAttribute('aria-selected', 'true')
        })

        it('exposes inactive tabs as unselected', () => {
            render(
                <TabButton
                    active={false}
                    icon={<span />}
                    label="Inactive Tab"
                    onClick={() => { }}
                />
            )

            expect(screen.getByRole('tab', { name: 'Inactive Tab' })).toHaveAttribute('aria-selected', 'false')
        })

        it('renders badge when provided', () => {
            render(
                <TabButton
                    active={false}
                    icon={<span />}
                    label="Tab with badge"
                    onClick={() => { }}
                    badge={5}
                />
            )
            expect(screen.getByText('5')).toBeDefined()
        })
    })

    describe('TabContainer', () => {
        it('renders children and applies layout classes', () => {
            render(
                <TabContainer>
                    <div data-testid="child">Child Content</div>
                </TabContainer>
            )
            expect(screen.getByTestId('child')).toBeDefined()
            const container = screen.getByTestId('child').parentElement
            expect(container).toHaveAttribute('role', 'tablist')
            expect(container).toHaveAttribute('aria-label', 'Seksjoner')
            expect(container?.className).toContain('overflow-x-auto')
            expect(container?.className).toContain('no-scrollbar')
        })
    })
})

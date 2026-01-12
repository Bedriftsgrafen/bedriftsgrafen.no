/**
 * Unit tests for explorerStore.
 *
 * Tests view modes, grouping, and export selection.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { useExplorerStore } from '../explorerStore'

// Reset store before each test
beforeEach(() => {
    useExplorerStore.setState({
        viewMode: 'list',
        groupBy: null,
        selectedForExport: [],
        isNaceModalOpen: false,
        isRegionModalOpen: false,
    })
})

describe('ExplorerStore Initial State', () => {
    it('should have list as default view mode', () => {
        expect(useExplorerStore.getState().viewMode).toBe('list')
    })

    it('should have null groupBy by default', () => {
        expect(useExplorerStore.getState().groupBy).toBeNull()
    })

    it('should have empty export selection', () => {
        expect(useExplorerStore.getState().selectedForExport).toEqual([])
    })

    it('should have modals closed by default', () => {
        const state = useExplorerStore.getState()
        expect(state.isNaceModalOpen).toBe(false)
        expect(state.isRegionModalOpen).toBe(false)
    })
})

describe('View Mode', () => {
    it('setViewMode should switch to cards', () => {
        useExplorerStore.getState().setViewMode('cards')
        expect(useExplorerStore.getState().viewMode).toBe('cards')
    })

    it('setViewMode should switch back to list', () => {
        useExplorerStore.getState().setViewMode('cards')
        useExplorerStore.getState().setViewMode('list')
        expect(useExplorerStore.getState().viewMode).toBe('list')
    })
})

describe('Group By', () => {
    it('setGroupBy should set to county', () => {
        useExplorerStore.getState().setGroupBy('county')
        expect(useExplorerStore.getState().groupBy).toBe('county')
    })

    it('setGroupBy should set to industry', () => {
        useExplorerStore.getState().setGroupBy('industry')
        expect(useExplorerStore.getState().groupBy).toBe('industry')
    })

    it('setGroupBy should clear with null', () => {
        useExplorerStore.getState().setGroupBy('county')
        useExplorerStore.getState().setGroupBy(null)
        expect(useExplorerStore.getState().groupBy).toBeNull()
    })
})

describe('Export Selection', () => {
    it('toggleExportSelection should add orgnr', () => {
        useExplorerStore.getState().toggleExportSelection('123456789')

        expect(useExplorerStore.getState().selectedForExport).toContain('123456789')
    })

    it('toggleExportSelection should remove existing orgnr', () => {
        useExplorerStore.getState().toggleExportSelection('123456789')
        useExplorerStore.getState().toggleExportSelection('123456789')

        expect(useExplorerStore.getState().selectedForExport).not.toContain('123456789')
    })

    it('selectAllForExport should replace selection', () => {
        useExplorerStore.getState().toggleExportSelection('111')
        useExplorerStore.getState().selectAllForExport(['222', '333', '444'])

        const selected = useExplorerStore.getState().selectedForExport
        expect(selected).toEqual(['222', '333', '444'])
        expect(selected).not.toContain('111')
    })

    it('clearExportSelection should empty the list', () => {
        useExplorerStore.getState().selectAllForExport(['111', '222', '333'])
        useExplorerStore.getState().clearExportSelection()

        expect(useExplorerStore.getState().selectedForExport).toEqual([])
    })
})

describe('Modal Controls', () => {
    it('setNaceModalOpen should open modal', () => {
        useExplorerStore.getState().setNaceModalOpen(true)
        expect(useExplorerStore.getState().isNaceModalOpen).toBe(true)
    })

    it('setNaceModalOpen should close modal', () => {
        useExplorerStore.getState().setNaceModalOpen(true)
        useExplorerStore.getState().setNaceModalOpen(false)
        expect(useExplorerStore.getState().isNaceModalOpen).toBe(false)
    })

    it('setRegionModalOpen should open modal', () => {
        useExplorerStore.getState().setRegionModalOpen(true)
        expect(useExplorerStore.getState().isRegionModalOpen).toBe(true)
    })

    it('setRegionModalOpen should close modal', () => {
        useExplorerStore.getState().setRegionModalOpen(true)
        useExplorerStore.getState().setRegionModalOpen(false)
        expect(useExplorerStore.getState().isRegionModalOpen).toBe(false)
    })
})

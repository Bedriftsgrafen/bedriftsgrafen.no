/**
 * Unit tests for favoritesStore.
 *
 * Tests favorites management with localStorage persistence.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFavoritesStore } from '../favoritesStore'

// Mock toast to prevent side effects
vi.mock('../toastStore', () => ({
    toast: {
        success: vi.fn(),
        info: vi.fn(),
        warning: vi.fn(),
        error: vi.fn(),
    },
}))

// Reset store before each test
beforeEach(() => {
    useFavoritesStore.setState({
        favorites: [],
    })
})

describe('FavoritesStore Initial State', () => {
    it('should start with empty favorites list', () => {
        const state = useFavoritesStore.getState()
        expect(state.favorites).toEqual([])
    })
})

describe('Add Favorite', () => {
    it('addFavorite should add company to favorites', () => {
        useFavoritesStore.getState().addFavorite({
            orgnr: '123456789',
            navn: 'Test Company AS',
        })

        const favorites = useFavoritesStore.getState().favorites
        expect(favorites).toHaveLength(1)
        expect(favorites[0].orgnr).toBe('123456789')
        expect(favorites[0].navn).toBe('Test Company AS')
    })

    it('addFavorite should not add duplicates', () => {
        useFavoritesStore.getState().addFavorite({ orgnr: '123', navn: 'Test' })
        useFavoritesStore.getState().addFavorite({ orgnr: '123', navn: 'Test Updated' })

        expect(useFavoritesStore.getState().favorites).toHaveLength(1)
    })

    it('addFavorite should add timestamp (addedAt)', () => {
        useFavoritesStore.getState().addFavorite({ orgnr: '123', navn: 'Test' })

        const fav = useFavoritesStore.getState().favorites[0]
        expect(fav.addedAt).toBeDefined()
        expect(typeof fav.addedAt).toBe('number')
    })
})

describe('Remove Favorite', () => {
    it('removeFavorite should remove by orgnr', () => {
        useFavoritesStore.getState().addFavorite({ orgnr: '111', navn: 'First' })
        useFavoritesStore.getState().addFavorite({ orgnr: '222', navn: 'Second' })
        useFavoritesStore.getState().removeFavorite('111')

        const favorites = useFavoritesStore.getState().favorites
        expect(favorites).toHaveLength(1)
        expect(favorites[0].orgnr).toBe('222')
    })

    it('removeFavorite should handle non-existent orgnr gracefully', () => {
        useFavoritesStore.getState().addFavorite({ orgnr: '111', navn: 'First' })
        useFavoritesStore.getState().removeFavorite('999')

        expect(useFavoritesStore.getState().favorites).toHaveLength(1)
    })
})

describe('Toggle Favorite', () => {
    it('toggleFavorite should add if not exists', () => {
        useFavoritesStore.getState().toggleFavorite({ orgnr: '123', navn: 'Test' })

        expect(useFavoritesStore.getState().favorites).toHaveLength(1)
    })

    it('toggleFavorite should remove if exists', () => {
        useFavoritesStore.getState().addFavorite({ orgnr: '123', navn: 'Test' })
        useFavoritesStore.getState().toggleFavorite({ orgnr: '123', navn: 'Test' })

        expect(useFavoritesStore.getState().favorites).toHaveLength(0)
    })
})

describe('IsFavorite Check', () => {
    it('isFavorite should return true for added company', () => {
        useFavoritesStore.getState().addFavorite({ orgnr: '123', navn: 'Test' })

        expect(useFavoritesStore.getState().isFavorite('123')).toBe(true)
    })

    it('isFavorite should return false for non-favorite', () => {
        expect(useFavoritesStore.getState().isFavorite('999')).toBe(false)
    })
})

describe('Clear Favorites', () => {
    it('clearFavorites should empty the list', () => {
        useFavoritesStore.getState().addFavorite({ orgnr: '111', navn: 'First' })
        useFavoritesStore.getState().addFavorite({ orgnr: '222', navn: 'Second' })
        useFavoritesStore.getState().clearFavorites()

        expect(useFavoritesStore.getState().favorites).toEqual([])
    })
})

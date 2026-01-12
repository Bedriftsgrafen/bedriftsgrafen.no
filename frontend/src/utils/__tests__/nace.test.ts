import { describe, it, expect } from 'vitest';
import { getNaceLevel } from '../nace';

describe('nace utils', () => {
    it('identifies division codes', () => {
        expect(getNaceLevel('62')).toBe('Hovedbransje');
        expect(getNaceLevel('01')).toBe('Hovedbransje');
    });

    it('identifies subclass codes', () => {
        expect(getNaceLevel('62.010')).toBe('Underbransje');
        expect(getNaceLevel('01.110')).toBe('Underbransje');
    });
});

import { describe, it, expect } from 'vitest';
import { getNaceLevel } from '../nace';

describe('nace utils', () => {
    it('identifies division codes', () => {
        expect(getNaceLevel('62')).toEqual(['62']);
        expect(getNaceLevel('01')).toEqual(['01']);
    });

    it('identifies subclass codes', () => {
        expect(getNaceLevel('62.010')).toEqual(['62', '010']);
        expect(getNaceLevel('01.110')).toEqual(['01', '110']);
    });
});
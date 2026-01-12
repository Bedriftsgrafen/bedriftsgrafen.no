import { describe, it, expect } from 'vitest';
import { companyQueryKeys, accountingQueryKeys } from '../queryKeys';

describe('companyQueryKeys', () => {
    it('generates consistent keys', () => {
        expect(companyQueryKeys.all).toEqual(['companies']);
        expect(companyQueryKeys.lists()).toEqual(['companies', 'list']);
        expect(companyQueryKeys.list({ page: 1 })).toEqual(['companies', 'list', { filters: { page: 1 } }]);
        expect(companyQueryKeys.details()).toEqual(['companies', 'detail']);
        expect(companyQueryKeys.detail('123')).toEqual(['companies', 'detail', '123']);
        expect(companyQueryKeys.count({ active: true })).toEqual(['companies', 'count', { filters: { active: true } }]);
    });
});

describe('accountingQueryKeys', () => {
    it('generates consistent keys', () => {
        expect(accountingQueryKeys.all).toEqual(['accounting']);
        expect(accountingQueryKeys.details()).toEqual(['accounting', 'detail']);
        expect(accountingQueryKeys.detail('123', 2023)).toEqual(['accounting', 'detail', '123', 2023]);
        expect(accountingQueryKeys.kpis()).toEqual(['accounting', 'kpi']);
        expect(accountingQueryKeys.kpi('123', 2023)).toEqual(['accounting', 'kpi', '123', 2023]);
    });
});

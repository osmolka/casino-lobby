import { describe, expect, it } from 'vitest';
import { getMockFlags } from './mockFlags';

describe('getMockFlags', () => {
  it('returns an empty set without the mock param', () => {
    expect(getMockFlags('?cat=slots').size).toBe(0);
  });

  it('parses comma-separated flags', () => {
    expect([...getMockFlags('?mock=fail-catalog,slow')].sort()).toEqual(['fail-catalog', 'slow']);
  });

  it('merges repeated mock params', () => {
    expect([...getMockFlags('?mock=slow&mock=empty-feed')].sort()).toEqual(['empty-feed', 'slow']);
  });

  it('drops unknown flags and junk', () => {
    expect([...getMockFlags('?mock=,nope,%E0,%20slow%20')]).toEqual(['slow']);
  });
});

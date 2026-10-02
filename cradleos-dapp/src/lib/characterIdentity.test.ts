import { describe, it, expect } from 'vitest';
import { characterGameId } from './characterIdentity';
describe('Character identity boundary', () => {
  it('reads EVE game ID from nested on-chain key', () => expect(characterGameId({ id: '0x123456', key: { fields: { item_id: '42' } } })).toBe(42));
  it('accepts flattened key data', () => expect(characterGameId({ key: { item_id: 42 } })).toBe(42));
  it.each([{}, {id:'0x1234'}, {key:{item_id:0}}, {key:{item_id:4294967296}}, {key:{item_id:'invalid'}}])('rejects absent or invalid game IDs %j', fields => expect(() => characterGameId(fields)).toThrow(/unavailable/));
});

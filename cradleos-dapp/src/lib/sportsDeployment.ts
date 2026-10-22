import { BOOK_DEPLOYMENT } from './bookDeployment';
/** Isolated Sui testnet sports release; exact IDs verified from publication. */
export const SPORTS_DEPLOYMENT = { ...BOOK_DEPLOYMENT,
 packageId: '0x7b705d0e74b7b8c5e8874db91e0cf717a89f8413d6e0a146398a7d4b1ceeb2c6', bookId: '0x31c07a935633158211587519945eed0a0d52add58f7e2548d9b5bab43c9acbe4', reporter: '0xd20ca4b642b3d4502fd6cb8aa9a5a6e92526457e247803edabb1bce6e1aa93c3', wageringEnabled: true,
};

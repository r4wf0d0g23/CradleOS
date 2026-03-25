export const WORLD_PKG = '0xd12a70c74c1e759445d6f209b01d43d860e97fcf2ef72ccbbd00afd828043f75';
export const RAW_CHARACTER_ID = '0x5ef314c39748d5027fe4aef711f92497a4ea9618886f107916f2df0f16034c1c';
export const RAW_NETWORK_NODE_ID = '0xbce555aedb0c1322232c4243ce62cfc6210293cb69be6b4fe212ab9b4ba49fd7';
export const RAW_NODE_OWNER_CAP = '0x1e69832d1977a6963ea93b4cf2feeb7e432cde4ae463ff2989f35de3c78765f2';
export const FUEL_CONFIG = '0x0f354c803af170ac0d1ac9068625c6321996b3013dc67bdaf14d06f93fa1671f';
export const ADMIN_ACL = '0xa8655c6721967e631d8fd157bc88f7943c5e1263335c4ab553247cd3177d4e86';
export const CLOCK = '0x6';
export const SUI_RPC = 'https://fullnode.testnet.sui.io:443';

export const MODULES = {
  character: `${WORLD_PKG}::character`,
  networkNode: `${WORLD_PKG}::network_node`,
  cradleCorp: `${WORLD_PKG}::cradleos::corp`,
} as const;

export const TYPES = {
  character: `${WORLD_PKG}::character::Character`,
  networkNode: `${WORLD_PKG}::network_node::NetworkNode`,
} as const;

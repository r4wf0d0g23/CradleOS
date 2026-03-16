/** @category Types */
export type ErrorType = {
  code: number;
  name: string;
  patterns: string[];
  message: string;
};

/** @category Utilities - Error helpers */
export const ERRORS: Record<number | string, ErrorType> = {
  1001: {
    code: 1001,
    name: "Unknown Error",
    patterns: ["unknown error"],
    message: "An unknown error occurred.",
  },
  1002: {
    code: 1002,
    name: "Network Error",
    patterns: ["network error", "connection failed", "failed to fetch"],
    message: "",
  },
  1003: {
    code: 1003,
    name: "Invalid Input Error",
    patterns: ["invalid input", "bad request", "malformed"],
    message: "",
  },
  2001: {
    code: 2001,
    name: "Contract Call Error",
    patterns: ["contract call error", "execution reverted", "out of gas"],
    message: "Error calling the smart contract.",
  },
  2002: {
    code: 2002,
    name: "Contract Deployment Error",
    patterns: ["contract deployment error", "contract creation failed"],
    message: "",
  },
  2003: {
    code: 2003,
    name: "World Resource Not Found Error",
    patterns: ["Error: World_ResourceNotFound"],
    message: "World resource not found.",
  },
  2004: {
    code: 2004,
    name: "ABI Function Not Found Error",
    patterns: ["AbiErrorSignatureNotFoundError"],
    message: "Function not found in ABI",
  },
  2005: {
    code: 2005,
    name: "ERC2771 Forwarder contract Not Found Error",
    patterns: ["Forwarder contract"],
    message: "ERC2771 forwarder contract could not be found",
  },
  2006: {
    code: 2006,
    name: "callFrom Function Not Found Error",
    patterns: ["callFrom Function"],
    message: "callFrom Function not found in ABI",
  },
  2007: {
    code: 2007,
    name: "Abi Encoding Bytes Size Mismatch Error",
    patterns: ["does not match expected size"],
    message: "Size of bytes does not match expected size.",
  },
  2008: {
    code: 2008,
    name: "Contract Revert Error",
    patterns: ["contract revert", "reverted"],
    message: "Function simulation reverted",
  },
  3001: {
    code: 3001,
    name: "Insufficient Gas",
    patterns: ["insufficient gas", "not enough gas", "balance too low"],
    message: "Insufficient funds for GAS.",
  },
  3002: {
    code: 3002,
    name: "Insufficient Eve",
    patterns: ["insufficient EVE", "not enough EVE"],
    message: "Insufficient EVE.",
  },
  3003: {
    code: 3003,
    name: "User Denied Transaction",
    patterns: [
      "User denied transaction signature.",
      "transaction rejected",
      "User rejected the request",
    ],
    message: "User rejected the transaction.",
  },
  3004: {
    code: 3004,
    name: "Transaction Timeout",
    patterns: ["transaction timeout", "timeout exceeded"],
    message: "",
  },
  4001: {
    code: 4001,
    name: "Unauthorized Access",
    patterns: ["unauthorized access", "permission denied"],
    message: "",
  },
  4002: {
    code: 4002,
    name: "User Not Logged In",
    patterns: ["user not logged in", "authentication required"],
    message: "",
  },
  4003: {
    code: 4003,
    name: "Chain Mismatch",
    patterns: ["does not match the target chain"],
    message: "Please check the chain your wallet is connected to.",
  },
  5001: {
    code: 5001,
    name: "Lens Unavailable",
    patterns: ["no lens"],
    message: "There are no lenses available here",
  },
};

/* Manually assign additional aliases for the ERRORS object */
ERRORS.UNKNOWN_ERROR = ERRORS[1001];
ERRORS.CONTRACT_CALL = ERRORS[2001];
ERRORS.ABI_FUNCTION_NOT_FOUND = ERRORS[2004];
ERRORS.FORWARDER_NOT_FOUND = ERRORS[2005];
ERRORS.CALLFROM_NOT_FOUND = ERRORS[2006];
ERRORS.INSUFFICIENT_EVE = ERRORS[3002];
ERRORS.LENS_UNAVAILABLE = ERRORS[5001];

/** @category Constants */
export const ERROR_MESSAGES: Record<number, string> = Object.fromEntries(
  Object.entries(ERRORS)
    .filter(([key]) => /^\d+$/.test(key))
    .map(([key, value]) => [Number(key), value.message]),
);

/** @category Utilities - Error helpers */
export const parseErrorFromMessage = (
  errorMessage: string,
): {
  code: number;
  name: string;
  patterns: string[];
} => {
  for (const error of Object.values(ERRORS)) {
    for (const pattern of error.patterns) {
      if (new RegExp(pattern, "i").test(errorMessage)) {
        return {
          code: +error.code,
          name: error.name,
          patterns: error.patterns,
        };
      }
    }
  }
  return {
    code: 1001,
    name: "Unknown Error",
    patterns: ["unknown error"],
  };
};

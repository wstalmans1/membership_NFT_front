import DAOGovernorAbi from './DAOGovernor.json';
import type { Abi } from 'viem';

// Type assertion: JSON imports don't preserve literal types (type: "function" becomes type: string)
// We use a double assertion to bypass this limitation while maintaining type safety for consumers
export const DAOGovernor = DAOGovernorAbi as any as Abi;


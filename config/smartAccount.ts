import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import {
  createKernelAccount,
  createKernelAccountClient,
  KernelEIP1193Provider,
} from '@zerodev/sdk';
import { KERNEL_V3_1, getEntryPoint } from '@zerodev/sdk/constants';
import { createPublicClient, http, type EIP1193Provider } from 'viem';
import { sepolia } from 'viem/chains';
import { createPimlicoClient } from 'permissionless/clients/pimlico';

// Standard Ethereum RPC for on-chain reads
const ALCHEMY_URL =
  process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ?? 'https://rpc.sepolia.org';

// Pimlico bundler + verifying paymaster endpoint for Sepolia
const PIMLICO_URL = `https://api.pimlico.io/v2/11155111/rpc?apikey=${process.env.NEXT_PUBLIC_PIMLICO_API_KEY}`;

const entryPoint = getEntryPoint('0.7');
const kernelVersion = KERNEL_V3_1;

/**
 * Converts a Privy embedded wallet (EIP1193Provider / EOA signer) into a
 * ZeroDev Kernel smart account, with Pimlico as the bundler and paymaster.
 *
 * Returns a KernelEIP1193Provider — ZeroDev's proper EIP1193 wrapper that
 * intercepts eth_sendTransaction and converts it into a sponsored user
 * operation, rather than sending a raw EOA transaction that would fail.
 *
 * This is the approach recommended by the Privy docs and is required for
 * useEmbeddedSmartAccountConnector to work correctly with wagmi hooks.
 */
export async function signerToSmartAccount({
  signer,
}: {
  signer: EIP1193Provider;
}): Promise<EIP1193Provider> {
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(ALCHEMY_URL),
  });

  // Build an ECDSA validator using the Privy embedded wallet as owner
  const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
    signer: signer as Parameters<typeof signerToEcdsaValidator>[1]['signer'],
    entryPoint,
    kernelVersion,
  });

  // Create the on-chain Kernel smart account address (deterministic from signer)
  const kernelAccount = await createKernelAccount(publicClient, {
    plugins: { sudo: ecdsaValidator },
    entryPoint,
    kernelVersion,
  });

  // Pimlico client used for gas sponsorship (paymaster)
  const pimlicoClient = createPimlicoClient({
    transport: http(PIMLICO_URL),
    entryPoint,
  });

  const kernelClient = createKernelAccountClient({
    account: kernelAccount,
    chain: sepolia,
    bundlerTransport: http(PIMLICO_URL),
    client: publicClient,
    paymaster: pimlicoClient,
    // Pass the Pimlico sponsorship policy so gas is covered by the policy
    ...(process.env.NEXT_PUBLIC_PIMLICO_POLICY_ID && {
      paymasterContext: {
        sponsorshipPolicyId: process.env.NEXT_PUBLIC_PIMLICO_POLICY_ID,
      },
    }),
    userOperation: {
      // Use the bundler's live gas price to avoid stale fee estimation errors
      estimateFeesPerGas: async () =>
        (await pimlicoClient.getUserOperationGasPrice()).fast,
    },
  });

  // KernelEIP1193Provider properly intercepts eth_sendTransaction and
  // converts it into a sponsored user operation — this is the critical piece
  // that prevents "insufficient funds" errors on the zero-balance embedded EOA.
  return new KernelEIP1193Provider(kernelClient) as unknown as EIP1193Provider;
}

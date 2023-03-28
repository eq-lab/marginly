import { ethers } from 'ethers';

export async function sendTransaction(
  contract: ethers.Contract,
  signer: ethers.Signer,
  method: string,
  args: any[],
  gasLimit: number,
  gasPrice: number,
  ethValue?: string
): Promise<ethers.providers.TransactionResponse> {
  console.log(`call ${method}(${args.join(', ')})`);
  const callData = await contract.populateTransaction[method](...args, {
    value: ethValue,
    gasLimit,
    gasPrice,
  });
  let tx;
  if (signer.provider === null) {
    tx = await signer.connect(contract.provider).sendTransaction(callData);
  } else {
    tx = await signer.sendTransaction(callData);
  }
  console.log(`Tx hash: ${tx.hash}`);

  try {
    const receipt = await waitForTx(contract.provider, tx.hash);
    console.log(`Tx successfully finished! Block: ${receipt?.blockNumber}`);
    return tx;
  } catch (err) {
    const revertReason = await getRevertReason(tx.hash, contract.provider);
    alert(`Tx failed. Revert reason is ${revertReason}. Error is ${err}`);
    throw err;
  }
}

export const waitForTx = async (
  provider: ethers.providers.Provider,
  hash: string
): Promise<ethers.providers.TransactionReceipt> => {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const receipt = await provider.getTransactionReceipt(hash);
    if (!receipt) {
      await sleep(3000);
    } else {
      if (!receipt.status) {
        throw new Error('Transaction failed');
      }
      return receipt;
    }
  }
};

export const sleep = (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/* Workaround to get revert reason*/
async function getRevertReason(txHash: string, provider: ethers.providers.Provider) {
  let tx = await provider.getTransaction(txHash);
  if (!tx) {
    console.log('tx not found');
    return null;
  } else {
    try {
      await provider.call(
        {
          to: tx.to,
          from: tx.from,
          nonce: tx.nonce,
          gasLimit: tx.gasLimit,
          gasPrice: tx.gasPrice,
          data: tx.data,
          value: tx.value,
          chainId: tx.chainId,
          type: tx.type ?? undefined,
          accessList: tx.accessList,
        },
        tx.blockNumber
      );
    } catch (err: any) {
      const code = err?.error?.error?.data;
      if (code) {
        let reason = hexToAscii(code.substr(138));
        console.log('revert reason:', reason);
        return reason;
      }
    }
  }

  return null;
}

function hexToAscii(hex: string) {
  var str = '';
  for (var n = 0; n < hex.length; n += 2) {
    const charCode = parseInt(hex.substr(n, 2), 16);
    if (charCode !== 0) {
      str += String.fromCharCode(charCode);
    }
  }
  return str;
}

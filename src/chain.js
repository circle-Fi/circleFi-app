/**
 * Everything that talks to Stellar. Reads are simulated against a public RPC
 * node, so they need no wallet, no account and no fee; writes are transactions
 * the member's own wallet signs. There is no CircleFi server anywhere in here.
 */
import {
  Account, Address, BASE_FEE, Contract, Networks, TransactionBuilder,
  nativeToScVal, rpc, scValToNative,
} from '@stellar/stellar-sdk';
import { isConnected, requestAccess, getAddress, signTransaction } from '@stellar/freighter-api';

export const RPC_URL = 'https://soroban-testnet.stellar.org';
export const PASSPHRASE = Networks.TESTNET;
const NULL_ACCOUNT = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

/** Set at build time; falls back to the deployed testnet factory. */
export const FACTORY =
  import.meta.env.VITE_FACTORY_ID || 'CCJRXTYIEFE6Z7DGTAKRGBLOGYBZNOONHI7FWZUDXEKZ7LGEGZNXKG3M';

export const server = new rpc.Server(RPC_URL);

/** Contract error codes, so a failure reaches a person as a sentence. */
const CIRCLE_ERRORS = {
  1: 'Contribution or round length was zero',
  2: 'Circle size must be between 3 and 24',
  3: 'This circle has already filled and started',
  4: 'This circle is not running',
  5: 'This circle has not finished yet',
  6: 'You are not a member of this circle',
  7: 'You have already joined this circle',
  8: 'You have already contributed to this round',
  9: 'The round is still open and not everyone has paid',
  10: 'Your deposit is already whole',
  11: 'Nothing left to withdraw',
};

export class ChainError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'ChainError';
    this.code = code;
  }
}

export function explain(e) {
  if (e instanceof ChainError) return e.message;
  const blob = `${e?.message || ''} ${(() => { try { return JSON.stringify(e); } catch { return ''; } })()}`;
  const m = /Error\(Contract,\s*#(\d+)\)/.exec(blob);
  if (m && CIRCLE_ERRORS[+m[1]]) return CIRCLE_ERRORS[+m[1]];
  if (/insufficient balance|balance is not sufficient/i.test(blob))
    return 'Not enough of that token in your wallet for this.';
  if (/trustline|not authorized/i.test(blob))
    return 'Your account cannot hold this token yet - add a trustline for it first.';
  if (/account not found|NOT_FOUND/i.test(blob))
    return 'That account does not exist on this network yet. Fund it with friendbot first.';
  return e?.message || String(e);
}

// ---- argument helpers ----
export const addr = (a) => new Address(a).toScVal();
export const u32 = (n) => nativeToScVal(Number(n), { type: 'u32' });
export const u64 = (n) => nativeToScVal(BigInt(n), { type: 'u64' });
export const i128 = (n) => nativeToScVal(BigInt(n), { type: 'i128' });

// ---- reads ----
export async function read(contractId, method, args = []) {
  const source = new Account(NULL_ACCOUNT, '0');
  const tx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: PASSPHRASE })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(30)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new ChainError(explain({ message: sim.error }));
  const retval = sim.result?.retval;
  return retval ? scValToNative(retval) : undefined;
}

// ---- writes ----
export async function invoke(contractId, method, args, wallet) {
  if (!wallet) throw new ChainError('Connect a wallet first.');
  const account = await server.getAccount(wallet);
  const built = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: PASSPHRASE })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(180)
    .build();

  // Simulating first means a call that would fail does so before the wallet
  // prompt, rather than after the fee is spent.
  const prepared = await server.prepareTransaction(built);
  const res = await signTransaction(prepared.toXDR(), { networkPassphrase: PASSPHRASE, address: wallet });
  if (res.error) throw new ChainError(String(res.error));

  const sent = await server.sendTransaction(
    TransactionBuilder.fromXDR(res.signedTxXdr, PASSPHRASE),
  );
  if (sent.status === 'ERROR') throw new ChainError(explain(sent.errorResult ?? sent));

  const done = await server.pollTransaction(sent.hash, {
    attempts: 30,
    sleepStrategy: rpc.LinearSleepStrategy,
  });
  if (done.status !== 'SUCCESS') throw new ChainError(explain(done.resultXdr ?? done.status));
  return {
    hash: sent.hash,
    value: done.returnValue ? scValToNative(done.returnValue) : undefined,
  };
}

// ---- wallet ----

/**
 * Freighter answers by posting to a content script; with no extension nothing
 * ever answers, so bound the wait instead of letting the UI hang.
 */
export async function walletAvailable(timeoutMs = 1500) {
  try {
    return await Promise.race([
      isConnected().then((r) => Boolean(r?.isConnected)),
      new Promise((r) => setTimeout(() => r(false), timeoutMs)),
    ]);
  } catch {
    return false;
  }
}

export async function connectWallet() {
  if (!(await walletAvailable())) {
    throw new ChainError('No Stellar wallet detected. Install Freighter, then reload this page.');
  }
  const res = await requestAccess();
  if (res.error) throw new ChainError(String(res.error));
  return res.address || (await getAddress()).address;
}

// ---- domain calls ----

export const factory = {
  count: () => read(FACTORY, 'count'),
  list: (offset, limit) => read(FACTORY, 'list', [u32(offset), u32(limit)]),
  create: (wallet, { token, contribution, roundSeconds, capacity }) =>
    invoke(FACTORY, 'create',
      [addr(wallet), addr(token), i128(contribution), u64(roundSeconds), u32(capacity)], wallet),
};

export const circle = {
  config: (id) => read(id, 'get_config'),
  state: (id) => read(id, 'get_state'),
  member: (id, who) => read(id, 'get_member', [addr(who)]),
  hasContributed: (id, round, who) => read(id, 'has_contributed', [u32(round), addr(who)]),
  join: (id, wallet) => invoke(id, 'join', [addr(wallet)], wallet),
  contribute: (id, wallet) => invoke(id, 'contribute', [addr(wallet)], wallet),
  topUp: (id, wallet) => invoke(id, 'top_up', [addr(wallet)], wallet),
  settle: (id, wallet) => invoke(id, 'settle', [], wallet),
  withdraw: (id, wallet) => invoke(id, 'withdraw_deposit', [addr(wallet)], wallet),
};

const tokenMetaCache = new Map();
export async function tokenMeta(tokenId) {
  if (tokenMetaCache.has(tokenId)) return tokenMetaCache.get(tokenId);
  const [decimals, symbol] = await Promise.all([
    read(tokenId, 'decimals').catch(() => 7),
    read(tokenId, 'symbol').catch(() => 'token'),
  ]);
  const meta = { decimals: Number(decimals), symbol: String(symbol) };
  tokenMetaCache.set(tokenId, meta);
  return meta;
}

export async function tokenBalance(tokenId, who) {
  try {
    return BigInt(await read(tokenId, 'balance', [addr(who)]));
  } catch {
    return null;
  }
}

/** The native asset's own contract - the default a new circle is priced in. */
export const NATIVE_SAC = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';

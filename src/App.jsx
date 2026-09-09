import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FACTORY, NATIVE_SAC, circle as circleApi, connectWallet, explain, factory,
  tokenBalance, tokenMeta, walletAvailable,
} from './chain.js';
import { amount, duration, remaining, short, statusOf, toUnits } from './format.js';

/* ---------- tiny hash router: #/ , #/new , #/c/<id> ---------- */
function useRoute() {
  const [hash, setHash] = useState(() => location.hash || '#/');
  useEffect(() => {
    const on = () => setHash(location.hash || '#/');
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'new') return { page: 'new' };
  if (parts[0] === 'c' && parts[1]) return { page: 'circle', id: parts[1] };
  return { page: 'browse' };
}
const go = (to) => { location.hash = to; };

/* ---------- wallet ---------- */
function useWallet() {
  const [wallet, setWallet] = useState(null);
  const [available, setAvailable] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { walletAvailable().then(setAvailable); }, []);

  const connect = useCallback(async () => {
    setError('');
    try { setWallet(await connectWallet()); }
    catch (e) { setError(explain(e)); }
  }, []);

  return { wallet, available, error, connect };
}

/* ---------- a button that runs a transaction and reports honestly ---------- */
function TxButton({ label, busyLabel = 'Waiting for your wallet...', run, onDone, ghost, disabled }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={ghost ? 'btn ghost' : 'btn'}
      disabled={busy || disabled}
      onClick={async () => {
        setBusy(true);
        try { const r = await run(); await onDone?.(null, r); }
        catch (e) { await onDone?.(explain(e)); }
        finally { setBusy(false); }
      }}
    >
      {busy ? busyLabel : label}
    </button>
  );
}

function Msg({ error, ok }) {
  if (!error && !ok) return null;
  return <p className={error ? 'msg' : 'msg ok'}>{error || ok}</p>;
}

/* ---------- browse ---------- */
function Browse({ wallet }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const listings = await factory.list(0, 24);
      const withState = await Promise.all(listings.map(async (l) => {
        const [st, meta] = await Promise.all([
          circleApi.state(l.address).catch(() => null),
          tokenMeta(l.token).catch(() => ({ decimals: 7, symbol: 'token' })),
        ]);
        return { ...l, st, meta };
      }));
      setRows(withState);
    } catch (e) { setError(explain(e)); setRows([]); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <div className="pagehead">
        <div>
          <h2>Circles</h2>
          <p className="sub">Anyone can open one. Anyone can join one that is still forming.</p>
        </div>
        <button className="btn" onClick={() => go('#/new')}>Start a circle</button>
      </div>

      <Msg error={error} />

      {rows === null && <p className="sub">Reading the chain...</p>}
      {rows?.length === 0 && !error && (
        <div className="empty">
          <p><strong>No circles yet.</strong> Be the first - starting one takes one transaction.</p>
          <button className="btn" onClick={() => go('#/new')}>Start the first circle</button>
        </div>
      )}

      <div className="grid">
        {rows?.map((r) => {
          const status = statusOf(r.st?.status);
          const seats = r.st ? r.st.members.length : 0;
          const mine = wallet && r.st?.members?.some((m) => m === wallet);
          return (
            <button key={r.address} className="card" onClick={() => go(`#/c/${r.address}`)}>
              <div className="cardtop">
                <span className={`pill ${status}`}>{status}</span>
                {mine && <span className="pill you">you are in</span>}
              </div>
              <p className="cardamt">{amount(r.contribution, r.meta.decimals, r.meta.symbol)}</p>
              <p className="sub">every {duration(r.round_seconds)}</p>
              <div className="cardfoot">
                <span>{seats} / {r.capacity} seats</span>
                <span className="mono">{short(r.address)}</span>
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}

/* ---------- create ---------- */
function Create({ wallet, onConnect }) {
  const [token, setToken] = useState(NATIVE_SAC);
  const [meta, setMeta] = useState({ decimals: 7, symbol: 'XLM' });
  const [contribution, setContribution] = useState('1');
  const [capacity, setCapacity] = useState('3');
  const [period, setPeriod] = useState('300');
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    tokenMeta(token).then((m) => live && setMeta(m)).catch(() => {});
    return () => { live = false; };
  }, [token]);

  const units = toUnits(contribution, meta.decimals);
  const cap = Number(capacity);
  const secs = Number(period);
  const problem =
    units === null || units <= 0n ? 'Enter a contribution greater than zero.'
      : !Number.isInteger(cap) || cap < 3 || cap > 24 ? 'A circle needs between 3 and 24 members.'
      : !Number.isInteger(secs) || secs <= 0 ? 'Pick a round length.'
      : '';

  return (
    <>
      <div className="pagehead">
        <div>
          <h2>Start a circle</h2>
          <p className="sub">
            You set the terms; they are fixed once the circle exists. Everyone can read them
            before putting in a unit.
          </p>
        </div>
        <button className="btn ghost" onClick={() => go('#/')}>Back</button>
      </div>

      <div className="form">
        <label className="field">
          <span>Contribution each round</span>
          <div className="withunit">
            <input value={contribution} onChange={(e) => setContribution(e.target.value)} inputMode="decimal" />
            <em>{meta.symbol}</em>
          </div>
        </label>

        <label className="field">
          <span>Members</span>
          <input value={capacity} onChange={(e) => setCapacity(e.target.value)} inputMode="numeric" />
        </label>

        <label className="field">
          <span>Round length</span>
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="300">5 minutes (for testing)</option>
            <option value="3600">1 hour</option>
            <option value="86400">1 day</option>
            <option value="604800">1 week</option>
            <option value="2592000">30 days</option>
          </select>
        </label>

        <label className="field wide">
          <span>Token</span>
          <input className="mono" value={token} onChange={(e) => setToken(e.target.value.trim())} spellCheck="false" />
        </label>
      </div>

      <p className="sub summary">
        {problem ? problem : (
          <>
            {cap} members put in {amount(units, meta.decimals, meta.symbol)} every {duration(secs)}.
            Each round one member takes{' '}
            <strong>{amount(units * BigInt(cap), meta.decimals, meta.symbol)}</strong>.
            Joining locks {amount(units, meta.decimals, meta.symbol)} as a deposit, returned at the end.
          </>
        )}
      </p>

      <Msg error={error} />

      <div className="actions">
        {wallet ? (
          <TxButton
            label="Create circle"
            disabled={!!problem}
            run={() => factory.create(wallet, {
              token, contribution: units, roundSeconds: secs, capacity: cap,
            })}
            onDone={(err, res) => {
              if (err) return setError(err);
              if (res?.value) go(`#/c/${res.value}`); else go('#/');
            }}
          />
        ) : (
          <button className="btn" onClick={onConnect}>Connect a wallet to create</button>
        )}
      </div>
    </>
  );
}

/* ---------- one circle ---------- */
function Circle({ id, wallet, onConnect }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    setError('');
    try {
      const [cfg, st] = await Promise.all([circleApi.config(id), circleApi.state(id)]);
      const meta = await tokenMeta(cfg.token);
      const round = Number(st.round);
      const members = await Promise.all(st.members.map(async (a) => ({
        address: a,
        rec: await circleApi.member(id, a).catch(() => null),
        paid: round > 0 ? await circleApi.hasContributed(id, round, a).catch(() => false) : false,
      })));
      const balance = wallet ? await tokenBalance(cfg.token, wallet) : null;
      setData({ cfg, st, meta, members, round, balance });
    } catch (e) { setError(explain(e)); setData(null); }
  }, [id, wallet]);

  useEffect(() => { load(); }, [load, tick]);

  // Keep "X min left" honest without hammering the node.
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const refresh = (err, res) => {
    if (err) { setError(err); setOk(''); return; }
    setError(''); setOk(res?.hash ? 'Done - the ledger has it.' : 'Done.');
    setTick((n) => n + 1);
  };

  if (error && !data) return (<><Back /><Msg error={error} /></>);
  if (!data) return (<><Back /><p className="sub">Reading the chain...</p></>);

  const { cfg, st, meta, members, round, balance } = data;
  const status = statusOf(st.status);
  const capacity = Number(cfg.capacity);
  const money = (v) => amount(v, meta.decimals, meta.symbol);
  const pot = BigInt(cfg.contribution) * BigInt(capacity);
  const me = members.find((m) => m.address === wallet);
  const everyonePaid = members.length > 0 && members.every((m) => m.paid);
  const windowClosed = Number(st.round_ends_at) <= Math.floor(Date.now() / 1000);

  let headline;
  if (status === 'forming') {
    const left = capacity - members.length;
    headline = `Forming - ${members.length} of ${capacity} seats taken. ${left} more and round 1 starts.`;
  } else if (status === 'complete') {
    headline = 'Complete - everyone has paid in and taken their turn. Deposits can be withdrawn.';
  } else {
    const who = st.members[round - 1];
    const unpaid = members.filter((m) => !m.paid).length;
    headline = `Round ${round} of ${capacity} - ${money(pot)} goes to ${who === wallet ? 'you' : short(who)}. ` +
      (unpaid ? `${unpaid} still to pay, ${remaining(st.round_ends_at)}.` : 'Everyone has paid; the round can be settled.');
  }

  const actions = [];
  if (!wallet) {
    actions.push(<button key="c" className="btn" onClick={onConnect}>Connect a wallet to take part</button>);
  } else if (status === 'forming' && !me) {
    actions.push(<TxButton key="j" label={`Join - locks ${money(cfg.contribution)}`}
      run={() => circleApi.join(id, wallet)} onDone={refresh} />);
  } else if (status === 'active' && me) {
    if (!me.paid) actions.push(<TxButton key="p" label={`Contribute ${money(cfg.contribution)}`}
      run={() => circleApi.contribute(id, wallet)} onDone={refresh} />);
    if (me.rec && BigInt(me.rec.deposit) < BigInt(cfg.contribution))
      actions.push(<TxButton key="t" ghost
        label={`Top up deposit (${money(BigInt(cfg.contribution) - BigInt(me.rec.deposit))})`}
        run={() => circleApi.topUp(id, wallet)} onDone={refresh} />);
    if (everyonePaid || windowClosed)
      actions.push(<TxButton key="s" ghost label="Settle this round"
        run={() => circleApi.settle(id, wallet)} onDone={refresh} />);
  } else if (status === 'complete' && me?.rec && BigInt(me.rec.deposit) > 0n) {
    actions.push(<TxButton key="w" label={`Withdraw deposit (${money(me.rec.deposit)})`}
      run={() => circleApi.withdraw(id, wallet)} onDone={refresh} />);
  }

  let note = '';
  if (wallet && status === 'forming' && me) note = `You are in at position ${members.indexOf(me) + 1} - that is the round you get paid.`;
  else if (wallet && status === 'active' && !me) note = 'This circle is running and closed to new members.';
  else if (wallet && status === 'active' && me?.paid && !everyonePaid && !windowClosed)
    note = `You are paid up for round ${round}. Waiting on the others - ${remaining(st.round_ends_at)}.`;
  else if (wallet && status === 'complete' && me && !(BigInt(me.rec?.deposit ?? 0) > 0n))
    note = 'Nothing left to withdraw - your deposit covered a round you missed.';
  if (wallet && balance !== null && status !== 'complete')
    note += `${note ? ' ' : ''}Your balance: ${money(balance)}.`;

  return (
    <>
      <Back />
      <p className={`headline ${status}`}>{headline}</p>

      <dl className="stats">
        {[['Contribution', money(cfg.contribution)], ['Pot', money(pot)],
          ['Members', `${members.length} / ${capacity}`], ['Round', duration(cfg.round_seconds)]]
          .map(([k, v]) => <div className="stat" key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl>

      <Msg error={error} ok={ok} />

      <h3>Your move</h3>
      <div className="actions">{actions.length ? actions : <p className="sub">Nothing for you to do right now.</p>}</div>
      {note && <p className="sub">{note}</p>}

      <h3>The rotation</h3>
      <p className="sub">Payout order is join order, fixed when the circle filled.</p>
      <div className="scroll">
        <table>
          <thead><tr><th>Round</th><th>Member</th><th>This round</th><th>Deposit</th><th>Missed</th><th>Paid out</th></tr></thead>
          <tbody>
            {members.length === 0 && <tr><td colSpan="6" className="sub">Nobody has joined yet.</td></tr>}
            {members.map((m, i) => (
              <tr key={m.address} className={`${m.address === wallet ? 'you' : ''} ${status === 'active' && i === round - 1 ? 'next' : ''}`}>
                <td>{i + 1}</td>
                <td className="mono">{short(m.address)}{m.address === wallet && <span className="pill you"> you</span>}</td>
                <td>{status !== 'active' ? <span className="pill">-</span>
                  : m.paid ? <span className="pill paid">paid</span> : <span className="pill due">due</span>}</td>
                <td>{m.rec ? (m.rec.delinquent ? <span className="pill bad">exhausted</span> : money(m.rec.deposit)) : '-'}</td>
                <td>{m.rec ? Number(m.rec.defaults) : 0}</td>
                <td>{m.rec?.received ? <span className="pill paid">yes</span> : <span className="pill">not yet</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="sub contractline">
        Circle contract <span className="mono">{id}</span> &middot;{' '}
        <a href={`https://stellar.expert/explorer/testnet/contract/${id}`} target="_blank" rel="noreferrer">
          view on stellar.expert
        </a>
      </p>
    </>
  );
}

const Back = () => <button className="btn ghost back" onClick={() => go('#/')}>All circles</button>;

/* ---------- shell ---------- */
export default function App() {
  const route = useRoute();
  const { wallet, available, error, connect } = useWallet();

  return (
    <>
      <header>
        <div className="wrap mh">
          <a className="brand" href="#/">
            <p className="eyebrow">Stellar &middot; Soroban &middot; testnet</p>
            <h1>CircleFi</h1>
          </a>
          <div className="wallet">
            {wallet
              ? <><span className="pill you">connected</span><p className="mono addr">{short(wallet)}</p></>
              : <button className="btn" onClick={connect}>
                  {available === false ? 'Install Freighter' : 'Connect wallet'}
                </button>}
          </div>
        </div>
      </header>

      <main className="wrap">
        <Msg error={error} />
        {route.page === 'browse' && <Browse wallet={wallet} />}
        {route.page === 'new' && <Create wallet={wallet} onConnect={connect} />}
        {route.page === 'circle' && <Circle id={route.id} wallet={wallet} onConnect={connect} />}
      </main>

      <footer className="wrap">
        <p>
          Reads are simulated against a public RPC node - no wallet, no account, no fee. Writes are
          transactions your own wallet signs. No server, no custody: the{' '}
          <a href="https://github.com/circle-Fi/circleFi-contract">contract</a> holds the funds and
          the rules, and anyone can settle a round.
        </p>
        <p className="mono tiny">factory {FACTORY}</p>
      </footer>
    </>
  );
}

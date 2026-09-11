import { useCallback, useEffect, useState } from 'react';
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

/* ---------- the ring ----------
   A circle drawn as a circle: one arc per seat, in join order, clockwise from
   the top. It is the whole product in one glance - how many seats, who has
   paid, whose turn it is - so it carries real information, not decoration. */
const polar = (c, r, deg) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [c + r * Math.cos(a), c + r * Math.sin(a)];
};

function arc(c, r, from, to) {
  const [x1, y1] = polar(c, r, from);
  const [x2, y2] = polar(c, r, to);
  return `M ${x1} ${y1} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x2} ${y2}`;
}

function Ring({ seats, size = 220, weight = 9, label, children }) {
  const n = Math.max(seats.length, 1);
  const c = size / 2;
  const r = c - weight;
  const gap = n > 12 ? 3 : n > 6 ? 5 : 7;
  const step = 360 / n;

  return (
    <div
      className="ringwrap"
      style={{ width: size, height: size }}
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      <svg className="ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" focusable="false">
        <circle className="track" cx={c} cy={c} r={r} fill="none" strokeWidth={1} opacity={0.5} />
        {seats.map((seat, i) => (
          <path
            key={i}
            className={seat.kind}
            d={arc(c, r, i * step + gap / 2, (i + 1) * step - gap / 2)}
            fill="none"
            strokeWidth={seat.strong ? weight + 4 : weight}
            strokeLinecap="round"
            opacity={seat.kind === 'open' ? 0.55 : 1}
          />
        ))}
      </svg>
      <div className="ringmid" aria-hidden={label ? 'true' : undefined}>{children}</div>
    </div>
  );
}

/** Seats for a circle that is still filling up. */
const formingSeats = (taken, capacity) =>
  Array.from({ length: capacity }, (_, i) => ({ kind: i < taken ? 'seat' : 'open' }));

/* ---------- small pieces ---------- */
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

const Back = () => (
  <a className="back" href="#/" onClick={() => go('#/')}>&larr; All circles</a>
);

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

  const open = rows?.filter((r) => statusOf(r.st?.status) === 'forming').length ?? 0;

  return (
    <>
      <section className="hero">
        <div>
          <h1 className="page">Save together,<br />and take your turn.</h1>
          <p className="lede">
            A group agrees on an amount and a rhythm. Everyone pays in each round; one member
            takes the whole pot. Everyone gets exactly one turn - and a deposit covers anyone
            who misses, so whoever&rsquo;s turn it is gets paid in full.
          </p>
          <div className="herocta">
            <button className="btn" onClick={() => go('#/new')}>Start a circle</button>
            <a className="btn ghost" href="https://github.com/circle-Fi/circleFi-contract"
               target="_blank" rel="noreferrer">Read the contract</a>
          </div>
          <dl className="rail">
            <div><dt>On chain</dt><dd>Stellar testnet</dd></div>
            <div><dt>Custody</dt><dd>None - the contract holds it</dd></div>
            <div><dt>To look</dt><dd>No wallet, no fee</dd></div>
          </dl>
        </div>
        <div className="heroart">
          <Ring
            size={216}
            weight={10}
            label="Sample savings ring: Round 3 of 6, your turn"
            seats={[
              { kind: 'paid' }, { kind: 'paid' }, { kind: 'seat', strong: true },
              { kind: 'due' }, { kind: 'seat' }, { kind: 'open' },
            ]}
          >
            <span className="k">Round 3 of 6</span>
            <span className="v">Your turn</span>
          </Ring>
        </div>
      </section>

      <div className="pagehead">
        <div>
          <h2>Open circles</h2>
          <p className="sub">
            {rows === null ? 'Reading the chain...'
              : `${rows.length} opened through the factory${open ? `, ${open} still taking members` : ''}.`}
          </p>
        </div>
        <button className="btn ghost small" onClick={load}>Refresh</button>
      </div>

      <Msg error={error} />

      {rows?.length === 0 && !error && (
        <div className="empty">
          <p><strong>No circles yet.</strong> Starting one takes a single transaction, and
            the terms are fixed the moment it exists.</p>
          <button className="btn" onClick={() => go('#/new')}>Start the first circle</button>
        </div>
      )}

      <div className="grid">
        {rows?.map((r) => {
          const status = statusOf(r.st?.status);
          const taken = r.st ? r.st.members.length : 0;
          const capacity = Number(r.capacity);
          const mine = wallet && r.st?.members?.some((m) => m === wallet);
          return (
            <button
              key={r.address}
              className="card"
              onClick={() => go(`#/c/${r.address}`)}
              aria-label={`Circle ${short(r.address)}, ${amount(r.contribution, r.meta.decimals, r.meta.symbol)} every ${duration(r.round_seconds)}, ${status}, ${taken} of ${capacity} seats filled`}
            >
              <Ring
                size={70}
                weight={5}
                label={`${taken} of ${capacity} seats filled`}
                seats={formingSeats(taken, capacity)}
              >
                <span className="v sm">{taken}</span>
              </Ring>
              <div>
                <p className="cardamt">{amount(r.contribution, r.meta.decimals, r.meta.symbol)}</p>
                <p className="sub">every {duration(r.round_seconds)}</p>
                <div className="cardfoot">
                  <span className={`pill ${status}`}>{status}</span>
                  {mine && <span className="pill you">you are in</span>}
                  <span>{taken} / {capacity} seats</span>
                </div>
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
  const [capacity, setCapacity] = useState('6');
  const [period, setPeriod] = useState('604800');
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
  const money = (v) => amount(v, meta.decimals, meta.symbol);
  const seats = problem ? formingSeats(0, 6) : formingSeats(1, cap);

  return (
    <>
      <Back />
      <div className="pagehead">
        <div>
          <h2>Start a circle</h2>
          <p className="sub">You set the terms. They are fixed once it exists, and anyone
            can read them before putting in a unit.</p>
        </div>
      </div>

      <div className="build">
        <div>
          <div className="form">
            <label className="field">
              <span>Contribution each round</span>
              <div className="withunit">
                <input value={contribution} inputMode="decimal"
                  onChange={(e) => setContribution(e.target.value)} />
                <em>{meta.symbol}</em>
              </div>
            </label>

            <label className="field">
              <span>Members</span>
              <input value={capacity} inputMode="numeric"
                onChange={(e) => setCapacity(e.target.value)} />
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

            <label className="field">
              <span>Token</span>
              <input className="mono" value={token} spellCheck="false"
                onChange={(e) => setToken(e.target.value.trim())} />
            </label>
          </div>

          <Msg error={error} />

          <div className="actions" style={{ marginTop: 24 }}>
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
            <button className="btn ghost" onClick={() => go('#/')}>Cancel</button>
          </div>
        </div>

        <aside className="preview">
          <Ring
            size={190}
            weight={8}
            label={problem ? 'Circle configuration preview' : `Pot each round: ${money(units * BigInt(cap))}, 1 of ${cap} seats filled`}
            seats={seats}
          >
            <span className="k">Pot each round</span>
            <span className="v">{problem ? '--' : money(units * BigInt(cap))}</span>
          </Ring>
          <p className="deal">
            {problem || (
              <>
                <strong>{cap} members</strong> put in <strong>{money(units)}</strong> every{' '}
                {duration(secs)}. Each round one of them takes the pot. Joining locks{' '}
                {money(units)} as a deposit, returned when the circle completes.
              </>
            )}
          </p>
        </aside>
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
  const recipient = status === 'active' ? st.members[round - 1] : null;

  const seats = status === 'forming'
    ? formingSeats(members.length, capacity)
    : members.map((m, i) => ({
      kind: status === 'complete' ? 'paid' : m.paid ? 'paid' : 'due',
      strong: i === round - 1 && status === 'active',
    }));

  let headline;
  if (status === 'forming') {
    const left = capacity - members.length;
    headline = `${left} more ${left === 1 ? 'member' : 'members'} and round 1 begins.`;
  } else if (status === 'complete') {
    headline = 'Every turn has been taken. Deposits are free to withdraw.';
  } else {
    const unpaid = members.filter((m) => !m.paid).length;
    headline = `${money(pot)} goes to ${recipient === wallet ? 'you' : short(recipient)} this round.`;
    if (unpaid) headline += ` ${unpaid} still to pay.`;
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
  if (wallet && status === 'forming' && me) note = `You are in at seat ${members.indexOf(me) + 1} - that is the round you get paid.`;
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
      <div className="detail">
        <Ring
          size={228}
          weight={10}
          label={
            status === 'forming'
              ? `Circle forming: ${members.length} of ${capacity} seats filled, pot ${money(pot)}`
              : status === 'complete'
              ? `Circle complete: pot ${money(pot)}, all turns taken`
              : `Circle round ${round} of ${capacity}: pot ${money(pot)}, ${members.filter((m) => m.paid).length} of ${capacity} paid`
          }
          seats={seats}
        >
          <span className="k">{status === 'active' ? 'This round' : 'Pot each round'}</span>
          <span className="v">{money(pot)}</span>
        </Ring>

        <div>
          <div className="cardfoot" style={{ marginTop: 0, marginBottom: 10 }}>
            <span className={`pill ${status}`}>{status}</span>
            {status === 'active' && <span className="pill flat">round {round} of {capacity}</span>}
            {status === 'active' && <span className="pill flat">{remaining(st.round_ends_at)}</span>}
          </div>
          <p className="headline">{headline}</p>

          <dl className="terms">
            <div><dt>Contribution</dt><dd>{money(cfg.contribution)}</dd></div>
            <div><dt>Every</dt><dd>{duration(cfg.round_seconds)}</dd></div>
            <div><dt>Members</dt><dd>{members.length} / {capacity}</dd></div>
            <div><dt>Deposit</dt><dd>{money(cfg.contribution)}</dd></div>
          </dl>

          <h3 style={{ marginTop: 28 }}>Your move</h3>
          <div className="actions">
            {actions.length ? actions : <p className="sub" style={{ margin: 0 }}>Nothing for you to do right now.</p>}
          </div>
          {note && <p className="note">{note}</p>}
          <Msg error={error} ok={ok} />
        </div>
      </div>

      <h3>The rotation</h3>
      <p className="sub" style={{ marginTop: -4, marginBottom: 14 }}>
        Payout order is join order, fixed the moment the circle filled.
      </p>
      <div className="scroll" tabIndex={0} role="region" aria-label="Rotation table">
        <table>
          <thead>
            <tr>
              <th scope="col">Seat</th>
              <th scope="col">Member</th>
              <th scope="col">This round</th>
              <th scope="col">Deposit</th>
              <th scope="col">Missed</th>
              <th scope="col">Paid out</th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 && (
              <tr><td colSpan="6" className="sub">Nobody has joined yet.</td></tr>
            )}
            {members.map((m, i) => {
              const isCurrentTurn = i === round - 1 && status === 'active';
              return (
                <tr
                  key={m.address}
                  className={`${m.address === wallet ? 'you' : ''} ${isCurrentTurn ? 'next' : ''}`}
                >
                  <th scope="row" className="seat-cell">
                    <span className="seatno" aria-label={`Seat ${i + 1}${isCurrentTurn ? ', currently taking turn' : ''}`}>
                      {i + 1}
                    </span>
                  </th>
                  <td className="mono">
                    {short(m.address)}
                    {m.address === wallet && (
                      <span className="pill you" style={{ marginLeft: 8 }} aria-label="You (connected wallet)">
                        you
                      </span>
                    )}
                  </td>
                  <td>
                    {status !== 'active' ? (
                      <span className="dim" aria-label="Not applicable">&mdash;</span>
                    ) : m.paid ? (
                      <span className="pill paid" aria-label="Status: Contribution paid for this round">paid</span>
                    ) : (
                      <span className="pill due" aria-label="Status: Contribution due for this round">due</span>
                    )}
                  </td>
                  <td>
                    {m.rec ? (
                      m.rec.delinquent ? (
                        <span className="pill bad" aria-label="Deposit status: Exhausted from missed rounds">exhausted</span>
                      ) : (
                        money(m.rec.deposit)
                      )
                    ) : '-'}
                  </td>
                  <td>{m.rec ? Number(m.rec.defaults) : 0}</td>
                  <td>
                    {m.rec?.received ? (
                      <span className="pill paid" aria-label="Paid out: Yes">yes</span>
                    ) : (
                      <span className="dim" aria-label="Paid out: Not yet">not yet</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="contractline">
        Circle contract <span className="mono">{id}</span> &middot;{' '}
        <a href={`https://stellar.expert/explorer/testnet/contract/${id}`} target="_blank" rel="noreferrer">
          view on stellar.expert
        </a>
      </p>
    </>
  );
}

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
            <p className="wordmark">Circle<b>Fi</b></p>
          </a>
          <div className="wallet">
            {wallet
              ? <span className="chip"><span className="dot" />{short(wallet)}</span>
              : <button className="btn small" onClick={connect}>
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
          Reads are simulated against a public RPC node - no wallet, no account, no fee.
          Writes are transactions your own wallet signs. No server and no custody anywhere:
          the <a href="https://github.com/circle-Fi/circleFi-contract">contract</a> holds the
          funds and the rules, and anyone may settle a round.
        </p>
        <p className="mono tiny">factory {FACTORY}</p>
      </footer>
    </>
  );
}

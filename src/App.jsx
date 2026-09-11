import { useCallback, useEffect, useState } from 'react';
import {
  FACTORY, NATIVE_SAC, circle as circleApi, connectWallet, explain, factory,
  tokenBalance, tokenMeta, walletAvailable,
} from './chain.js';
import { amount, duration, remaining, short, statusOf, toUnits } from './format.js';
import { I18nProvider, SUPPORTED_LANGUAGES, useI18n } from './i18n.jsx';

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

function Ring({ seats, size = 220, weight = 9, children }) {
  const n = Math.max(seats.length, 1);
  const c = size / 2;
  const r = c - weight;
  const gap = n > 12 ? 3 : n > 6 ? 5 : 7;
  const step = 360 / n;

  return (
    <div className="ringwrap" style={{ width: size, height: size }}>
      <svg className="ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
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
      <div className="ringmid">{children}</div>
    </div>
  );
}

/** Seats for a circle that is still filling up. */
const formingSeats = (taken, capacity) =>
  Array.from({ length: capacity }, (_, i) => ({ kind: i < taken ? 'seat' : 'open' }));

/* ---------- small pieces ---------- */
function TxButton({ label, busyLabel, run, onDone, ghost, disabled }) {
  const { t } = useI18n();
  const defaultBusy = t('nav.waiting_wallet');
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
      {busy ? (busyLabel || defaultBusy) : label}
    </button>
  );
}

function Msg({ error, ok }) {
  if (!error && !ok) return null;
  return <p className={error ? 'msg' : 'msg ok'}>{error || ok}</p>;
}

function Back() {
  const { t } = useI18n();
  return (
    <a className="back" href="#/" onClick={() => go('#/')}>
      {t('nav.all_circles')}
    </a>
  );
}

function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();
  return (
    <div className="lang-switcher">
      <select
        aria-label="Language selection"
        value={locale}
        onChange={(e) => setLocale(e.target.value)}
        className="lang-select"
      >
        {SUPPORTED_LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ---------- browse ---------- */
function Browse({ wallet }) {
  const { t } = useI18n();
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
          <h1 className="page">{t('hero.title_line1')}<br />{t('hero.title_line2')}</h1>
          <p className="lede">
            {t('hero.lede')}
          </p>
          <div className="herocta">
            <button className="btn" onClick={() => go('#/new')}>{t('hero.start_circle')}</button>
            <a className="btn ghost" href="https://github.com/circle-Fi/circleFi-contract"
               target="_blank" rel="noreferrer">{t('hero.read_contract')}</a>
          </div>
          <dl className="rail">
            <div><dt>{t('hero.rail_onchain_label')}</dt><dd>{t('hero.rail_onchain_value')}</dd></div>
            <div><dt>{t('hero.rail_custody_label')}</dt><dd>{t('hero.rail_custody_value')}</dd></div>
            <div><dt>{t('hero.rail_look_label')}</dt><dd>{t('hero.rail_look_value')}</dd></div>
          </dl>
        </div>
        <div className="heroart">
          <Ring size={216} weight={10} seats={[
            { kind: 'paid' }, { kind: 'paid' }, { kind: 'seat', strong: true },
            { kind: 'due' }, { kind: 'seat' }, { kind: 'open' },
          ]}>
            <span className="k">{t('hero.ring_round', { current: 3, total: 6 })}</span>
            <span className="v">{t('hero.ring_your_turn')}</span>
          </Ring>
        </div>
      </section>

      <div className="pagehead">
        <div>
          <h2>{t('browse.title')}</h2>
          <p className="sub">
            {rows === null ? t('browse.reading')
              : `${t('browse.opened_summary', { count: rows.length })}${open ? t('browse.taking_members', { count: open }) : ''}.`}
          </p>
        </div>
        <button className="btn ghost small" onClick={load}>{t('browse.refresh')}</button>
      </div>

      <Msg error={error} />

      {rows?.length === 0 && !error && (
        <div className="empty">
          <p><strong>{t('browse.empty_title')}</strong> {t('browse.empty_desc')}</p>
          <button className="btn" onClick={() => go('#/new')}>{t('browse.start_first')}</button>
        </div>
      )}

      <div className="grid">
        {rows?.map((r) => {
          const rawStatus = statusOf(r.st?.status);
          const localizedStatus = t(`status.${rawStatus}`);
          const taken = r.st ? r.st.members.length : 0;
          const capacity = Number(r.capacity);
          const mine = wallet && r.st?.members?.some((m) => m === wallet);
          return (
            <button key={r.address} className="card" onClick={() => go(`#/c/${r.address}`)}>
              <Ring size={70} weight={5} seats={formingSeats(taken, capacity)}>
                <span className="v sm">{taken}</span>
              </Ring>
              <div>
                <p className="cardamt">{amount(r.contribution, r.meta.decimals, r.meta.symbol)}</p>
                <p className="sub">{t('browse.every', { duration: duration(r.round_seconds, t) })}</p>
                <div className="cardfoot">
                  <span className={`pill ${rawStatus}`}>{localizedStatus}</span>
                  {mine && <span className="pill you">{t('browse.you_are_in')}</span>}
                  <span>{t('browse.seats_count', { taken, capacity })}</span>
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
  const { t } = useI18n();
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
    units === null || units <= 0n ? t('create.err_contribution')
      : !Number.isInteger(cap) || cap < 3 || cap > 24 ? t('create.err_members')
      : !Number.isInteger(secs) || secs <= 0 ? t('create.err_period')
      : '';
  const money = (v) => amount(v, meta.decimals, meta.symbol);
  const seats = problem ? formingSeats(0, 6) : formingSeats(1, cap);

  return (
    <>
      <Back />
      <div className="pagehead">
        <div>
          <h2>{t('create.title')}</h2>
          <p className="sub">{t('create.sub')}</p>
        </div>
      </div>

      <div className="build">
        <div>
          <div className="form">
            <label className="field">
              <span>{t('create.contribution_label')}</span>
              <div className="withunit">
                <input value={contribution} inputMode="decimal"
                  onChange={(e) => setContribution(e.target.value)} />
                <em>{meta.symbol}</em>
              </div>
            </label>

            <label className="field">
              <span>{t('create.members_label')}</span>
              <input value={capacity} inputMode="numeric"
                onChange={(e) => setCapacity(e.target.value)} />
            </label>

            <label className="field">
              <span>{t('create.round_length_label')}</span>
              <select value={period} onChange={(e) => setPeriod(e.target.value)}>
                <option value="300">{t('create.opt_5min')}</option>
                <option value="3600">{t('create.opt_1hour')}</option>
                <option value="86400">{t('create.opt_1day')}</option>
                <option value="604800">{t('create.opt_1week')}</option>
                <option value="2592000">{t('create.opt_30days')}</option>
              </select>
            </label>

            <label className="field">
              <span>{t('create.token_label')}</span>
              <input className="mono" value={token} spellCheck="false"
                onChange={(e) => setToken(e.target.value.trim())} />
            </label>
          </div>

          <Msg error={error} />

          <div className="actions" style={{ marginTop: 24 }}>
            {wallet ? (
              <TxButton
                label={t('create.btn_create')}
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
              <button className="btn" onClick={onConnect}>{t('create.btn_connect')}</button>
            )}
            <button className="btn ghost" onClick={() => go('#/')}>{t('create.btn_cancel')}</button>
          </div>
        </div>

        <aside className="preview">
          <Ring size={190} weight={8} seats={seats}>
            <span className="k">{t('create.pot_each_round')}</span>
            <span className="v">{problem ? '--' : money(units * BigInt(cap))}</span>
          </Ring>
          <p className="deal">
            {problem || (
              <>
                <strong>{t('create.deal_part1', { capacity: cap })}</strong> {t('create.deal_part2')} <strong>{money(units)}</strong> {t('create.deal_part3', { duration: duration(secs, t) })} {t('create.deal_part4')} {money(units)} {t('create.deal_part5')}
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
  const { t } = useI18n();
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
    const tInterval = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(tInterval);
  }, []);

  const refresh = (err, res) => {
    if (err) { setError(err); setOk(''); return; }
    setError(''); setOk(res?.hash ? t('circle.done_ledger') : t('circle.done'));
    setTick((n) => n + 1);
  };

  if (error && !data) return (<><Back /><Msg error={error} /></>);
  if (!data) return (<><Back /><p className="sub">{t('circle.reading')}</p></>);

  const { cfg, st, meta, members, round, balance } = data;
  const rawStatus = statusOf(st.status);
  const localizedStatus = t(`status.${rawStatus}`);
  const capacity = Number(cfg.capacity);
  const money = (v) => amount(v, meta.decimals, meta.symbol);
  const pot = BigInt(cfg.contribution) * BigInt(capacity);
  const me = members.find((m) => m.address === wallet);
  const everyonePaid = members.length > 0 && members.every((m) => m.paid);
  const windowClosed = Number(st.round_ends_at) <= Math.floor(Date.now() / 1000);
  const recipient = rawStatus === 'active' ? st.members[round - 1] : null;

  const seats = rawStatus === 'forming'
    ? formingSeats(members.length, capacity)
    : members.map((m, i) => ({
      kind: rawStatus === 'complete' ? 'paid' : m.paid ? 'paid' : 'due',
      strong: i === round - 1 && rawStatus === 'active',
    }));

  let headline;
  if (rawStatus === 'forming') {
    const left = capacity - members.length;
    const memberWord = left === 1 ? t('circle.member_singular') : t('circle.member_plural');
    headline = t('circle.headline_forming', { count: left, member_word: memberWord });
  } else if (rawStatus === 'complete') {
    headline = t('circle.headline_complete');
  } else {
    const unpaid = members.filter((m) => !m.paid).length;
    const recipientName = recipient === wallet ? t('circle.you') : short(recipient);
    headline = t('circle.headline_active', { amount: money(pot), recipient: recipientName });
    if (unpaid) headline += t('circle.headline_unpaid', { count: unpaid });
  }

  const actions = [];
  if (!wallet) {
    actions.push(<button key="c" className="btn" onClick={onConnect}>{t('circle.btn_connect')}</button>);
  } else if (rawStatus === 'forming' && !me) {
    actions.push(<TxButton key="j" label={t('circle.btn_join', { amount: money(cfg.contribution) })}
      run={() => circleApi.join(id, wallet)} onDone={refresh} />);
  } else if (rawStatus === 'active' && me) {
    if (!me.paid) actions.push(<TxButton key="p" label={t('circle.btn_contribute', { amount: money(cfg.contribution) })}
      run={() => circleApi.contribute(id, wallet)} onDone={refresh} />);
    if (me.rec && BigInt(me.rec.deposit) < BigInt(cfg.contribution))
      actions.push(<TxButton key="t" ghost
        label={t('circle.btn_top_up', { amount: money(BigInt(cfg.contribution) - BigInt(me.rec.deposit)) })}
        run={() => circleApi.topUp(id, wallet)} onDone={refresh} />);
    if (everyonePaid || windowClosed)
      actions.push(<TxButton key="s" ghost label={t('circle.btn_settle')}
        run={() => circleApi.settle(id, wallet)} onDone={refresh} />);
  } else if (rawStatus === 'complete' && me?.rec && BigInt(me.rec.deposit) > 0n) {
    actions.push(<TxButton key="w" label={t('circle.btn_withdraw', { amount: money(me.rec.deposit) })}
      run={() => circleApi.withdraw(id, wallet)} onDone={refresh} />);
  }

  let note = '';
  if (wallet && rawStatus === 'forming' && me) note = t('circle.note_forming', { seat: members.indexOf(me) + 1 });
  else if (wallet && rawStatus === 'active' && !me) note = t('circle.note_active_not_in');
  else if (wallet && rawStatus === 'active' && me?.paid && !everyonePaid && !windowClosed)
    note = t('circle.note_active_paid', { round, remaining: remaining(st.round_ends_at, t) });
  else if (wallet && rawStatus === 'complete' && me && !(BigInt(me.rec?.deposit ?? 0) > 0n))
    note = t('circle.note_complete_exhausted');
  if (wallet && balance !== null && rawStatus !== 'complete')
    note += `${note ? ' ' : ''}${t('circle.note_balance', { amount: money(balance) })}`;

  return (
    <>
      <Back />
      <div className="detail">
        <Ring size={228} weight={10} seats={seats}>
          <span className="k">{rawStatus === 'active' ? t('circle.this_round') : t('circle.pot_each_round')}</span>
          <span className="v">{money(pot)}</span>
        </Ring>

        <div>
          <div className="cardfoot" style={{ marginTop: 0, marginBottom: 10 }}>
            <span className={`pill ${rawStatus}`}>{localizedStatus}</span>
            {rawStatus === 'active' && <span className="pill flat">{t('circle.round_of', { round, capacity })}</span>}
            {rawStatus === 'active' && <span className="pill flat">{remaining(st.round_ends_at, t)}</span>}
          </div>
          <p className="headline">{headline}</p>

          <dl className="terms">
            <div><dt>{t('circle.term_contribution')}</dt><dd>{money(cfg.contribution)}</dd></div>
            <div><dt>{t('circle.term_every')}</dt><dd>{duration(cfg.round_seconds, t)}</dd></div>
            <div><dt>{t('circle.term_members')}</dt><dd>{members.length} / {capacity}</dd></div>
            <div><dt>{t('circle.term_deposit')}</dt><dd>{money(cfg.contribution)}</dd></div>
          </dl>

          <h3 style={{ marginTop: 28 }}>{t('circle.your_move')}</h3>
          <div className="actions">
            {actions.length ? actions : <p className="sub" style={{ margin: 0 }}>{t('circle.nothing_to_do')}</p>}
          </div>
          {note && <p className="note">{note}</p>}
          <Msg error={error} ok={ok} />
        </div>
      </div>

      <h3>{t('circle.rotation_title')}</h3>
      <p className="sub" style={{ marginTop: -4, marginBottom: 14 }}>
        {t('circle.rotation_sub')}
      </p>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>{t('circle.th_seat')}</th>
              <th>{t('circle.th_member')}</th>
              <th>{t('circle.th_this_round')}</th>
              <th>{t('circle.th_deposit')}</th>
              <th>{t('circle.th_missed')}</th>
              <th>{t('circle.th_paid_out')}</th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 && (
              <tr><td colSpan="6" className="sub">{t('circle.empty_members')}</td></tr>
            )}
            {members.map((m, i) => (
              <tr key={m.address}
                className={`${m.address === wallet ? 'you' : ''} ${i === round - 1 && rawStatus === 'active' ? 'next' : ''}`}>
                <td><span className="seatno">{i + 1}</span></td>
                <td className="mono">
                  {short(m.address)}{m.address === wallet && <span className="pill you" style={{ marginLeft: 8 }}>{t('circle.you')}</span>}
                </td>
                <td>{rawStatus !== 'active' ? <span className="dim">&mdash;</span>
                  : m.paid ? <span className="pill paid">{t('status.paid')}</span> : <span className="pill due">{t('status.due')}</span>}</td>
                <td>{m.rec ? (m.rec.delinquent ? <span className="pill bad">{t('circle.exhausted')}</span> : money(m.rec.deposit)) : '-'}</td>
                <td>{m.rec ? Number(m.rec.defaults) : 0}</td>
                <td>{m.rec?.received ? <span className="pill paid">{t('circle.yes')}</span> : <span className="dim">{t('circle.not_yet')}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="contractline">
        {t('circle.contract_prefix')} <span className="mono">{id}</span> &middot;{' '}
        <a href={`https://stellar.expert/explorer/testnet/contract/${id}`} target="_blank" rel="noreferrer">
          {t('circle.view_on_explorer')}
        </a>
      </p>
    </>
  );
}

/* ---------- main layout component ---------- */
function MainContent() {
  const route = useRoute();
  const { wallet, available, error, connect } = useWallet();
  const { t } = useI18n();

  return (
    <>
      <header>
        <div className="wrap mh">
          <a className="brand" href="#/">
            <p className="eyebrow">{t('brand.eyebrow')}</p>
            <p className="wordmark">{t('brand.name')}<b>{t('brand.name_highlight')}</b></p>
          </a>
          <div className="wallet">
            <LanguageSwitcher />
            {wallet
              ? <span className="chip"><span className="dot" />{short(wallet)}</span>
              : <button className="btn small" onClick={connect}>
                  {available === false ? t('nav.install_freighter') : t('nav.connect_wallet')}
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
          {t('footer.desc', {
            contractLink: (
              <a key="c" href="https://github.com/circle-Fi/circleFi-contract">
                {t('footer.contract_word')}
              </a>
            )
          })}
        </p>
        <p className="mono tiny">{t('footer.factory', { address: FACTORY })}</p>
      </footer>
    </>
  );
}

/* ---------- shell with i18n provider ---------- */
export default function App() {
  return (
    <I18nProvider>
      <MainContent />
    </I18nProvider>
  );
}

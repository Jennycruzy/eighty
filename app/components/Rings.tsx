import { useEffect, useState } from "react";

import {
  REQUIRED_HOURS,
  REQUIRED_INCOME_CENTS,
} from "../../server/rules/constants";
import { useLanguage } from "../lib/language";

export interface RingValues {
  hours: number | null;
  amountCents: number | null;
  /** The same month if every waiting line were confirmed. */
  ifConfirmed?: { hours: number | null; amountCents: number | null } | null;
}

const OUTER = 80;
const INNER = 50;
const STROKE = 24;
const circumference = (r: number) => 2 * Math.PI * r;
const share = (value: number | null | undefined, target: number) =>
  Math.max(0, Math.min(1, (value ?? 0) / target));

function Arc({
  r,
  from,
  to,
  className,
}: {
  r: number;
  from: number;
  to: number;
  className: string;
}) {
  const c = circumference(r);
  const length = Math.max(0, to - from) * c;
  return (
    <circle
      className={className}
      cx="100"
      cy="100"
      r={r}
      strokeWidth={STROKE}
      strokeDasharray={`${length} ${c}`}
      strokeDashoffset={-from * c}
      transform="rotate(-90 100 100)"
    />
  );
}

function Ring({
  kind,
  r,
  done,
  waiting,
}: {
  kind: "hours" | "pay";
  r: number;
  done: number;
  waiting: number;
}) {
  return (
    <g className={`ring-${kind}${done >= 1 ? " ring-closed" : ""}`}>
      <circle
        className="ring-track"
        cx="100"
        cy="100"
        r={r}
        strokeWidth={STROKE}
      />
      {waiting > done && (
        <Arc r={r} from={0} to={waiting} className="ring-arc proposed" />
      )}
      {done > 0 && <Arc r={r} from={0} to={done} className="ring-arc" />}
    </g>
  );
}

/**
 * The month as two rings: hours toward 80, and pay toward 80 hours at the
 * federal minimum wage. Either one closed meets the rule's numbers.
 */
export function Rings({
  values,
  title,
  legend = true,
  animate = true,
}: {
  values: RingValues;
  title: string;
  legend?: boolean;
  animate?: boolean;
}) {
  const lang = useLanguage();
  const es = lang === "es";
  const target = {
    hours: share(values.hours, REQUIRED_HOURS),
    pay: share(values.amountCents, REQUIRED_INCOME_CENTS),
    hoursIf: share(values.ifConfirmed?.hours ?? values.hours, REQUIRED_HOURS),
    payIf: share(
      values.ifConfirmed?.amountCents ?? values.amountCents,
      REQUIRED_INCOME_CENTS,
    ),
  };
  // Start empty and fill, the way a ring app opens. Later changes animate too.
  const [shown, setShown] = useState(
    animate ? { hours: 0, pay: 0, hoursIf: 0, payIf: 0 } : target,
  );
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(target));
    return () => cancelAnimationFrame(frame);
  }, [target.hours, target.pay, target.hoursIf, target.payIf]);

  const number = (value: number) =>
    value.toLocaleString(es ? "es-US" : "en-US", { maximumFractionDigits: 1 });
  const money = (cents: number) =>
    new Intl.NumberFormat(es ? "es-US" : "en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: cents % 100 ? 2 : 0,
    }).format(cents / 100);
  const hoursWaiting =
    values.ifConfirmed?.hours != null &&
    values.ifConfirmed.hours > (values.hours ?? 0)
      ? values.ifConfirmed.hours - (values.hours ?? 0)
      : 0;
  const payWaiting =
    values.ifConfirmed?.amountCents != null &&
    values.ifConfirmed.amountCents > (values.amountCents ?? 0)
      ? values.ifConfirmed.amountCents - (values.amountCents ?? 0)
      : 0;
  const label = es
    ? `${title}: ${number(values.hours ?? 0)} de ${REQUIRED_HOURS} horas y ${money(values.amountCents ?? 0)} de ${money(REQUIRED_INCOME_CENTS)} en pago confirmados.`
    : `${title}: ${number(values.hours ?? 0)} of ${REQUIRED_HOURS} hours and ${money(values.amountCents ?? 0)} of ${money(REQUIRED_INCOME_CENTS)} pay confirmed.`;

  return (
    <div className="rings">
      <svg viewBox="0 0 200 200" role="img" aria-label={label}>
        <Ring kind="hours" r={OUTER} done={shown.hours} waiting={shown.hoursIf} />
        <Ring kind="pay" r={INNER} done={shown.pay} waiting={shown.payIf} />
      </svg>
      {legend && (
        <dl className="ring-legend" aria-hidden="true">
          <div className="hours">
            <dt>{es ? "Horas" : "Hours"}</dt>
            <dd>
              {number(values.hours ?? 0)}
              <small>/{REQUIRED_HOURS}</small>
              {hoursWaiting > 0 && (
                <span className="waiting">
                  {es
                    ? `+${number(hoursWaiting)} por revisar`
                    : `+${number(hoursWaiting)} to check`}
                </span>
              )}
            </dd>
          </div>
          <p className="ring-or">{es ? "o" : "or"}</p>
          <div className="pay">
            <dt>{es ? "Pago" : "Pay"}</dt>
            <dd>
              {money(values.amountCents ?? 0)}
              <small>/{money(REQUIRED_INCOME_CENTS)}</small>
              {payWaiting > 0 && (
                <span className="waiting">
                  {es
                    ? `+${money(payWaiting)} por revisar`
                    : `+${money(payWaiting)} to check`}
                </span>
              )}
            </dd>
          </div>
        </dl>
      )}
    </div>
  );
}

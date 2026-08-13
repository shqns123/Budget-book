"use client";

import { AppShell } from "@/components/app-shell";
import importedLedger from "@/data/imported-ledger.json";
import { won } from "@/lib/ledger";

type ImportedAccount = (typeof importedLedger.accounts)[number];

export default function BalancePage() {
  return (
    <AppShell>
      {({ month }) => {
        const cutoff = `${month}-31`;
        const amounts = new Map(
          importedLedger.accounts.map((account) => [
            account.id,
            account.openingBalance,
          ]),
        );
        const isLiability = (accountId: string) =>
          importedLedger.accounts.find((account) => account.id === accountId)
            ?.classification !== "asset";
        const applyChange = (accountId: string, assetChange: number) => {
          const change = isLiability(accountId) ? -assetChange : assetChange;
          amounts.set(accountId, (amounts.get(accountId) ?? 0) + change);
        };
        importedLedger.transactions
          .filter((item) => item.date <= cutoff)
          .forEach((item) => {
            if (item.type === "income")
              applyChange(item.accountId, item.amount);
            if (item.type === "expense")
              applyChange(item.accountId, -item.amount);
            if (item.type === "transfer") {
              applyChange(item.accountId, -item.amount);
              if (item.toAccountId) applyChange(item.toAccountId, item.amount);
            }
          });
        const scoped = importedLedger.accounts;
        const groups = (classification: string) =>
          Object.values(
            scoped
              .filter((account) => account.classification === classification)
              .reduce<Record<string, typeof scoped>>((result, account) => {
                (result[account.majorCategory] ??= []).push(account);
                return result;
              }, {}),
          );
        const liabilityGroups = Object.values(
          scoped
            .filter((account) => account.classification !== "asset")
            .reduce<Record<string, typeof scoped>>((result, account) => {
              const group =
                account.type === "card"
                  ? account.minorCategory.includes("할부")
                    ? "할부"
                    : "일시불"
                  : account.majorCategory;
              (result[group] ??= []).push(account);
              return result;
            }, {}),
        ).sort((left, right) => {
          const order = (account: ImportedAccount) =>
            account.type === "card"
              ? account.minorCategory.includes("할부")
                ? 1
                : 0
              : 2;
          return order(left[0]) - order(right[0]);
        });
        const assetTotal = scoped
          .filter((account) => account.classification === "asset")
          .reduce((sum, account) => sum + (amounts.get(account.id) ?? 0), 0);
        const liabilityTotal = scoped
          .filter((account) => account.classification !== "asset")
          .reduce(
            (sum, account) => sum + Math.abs(amounts.get(account.id) ?? 0),
            0,
          );
        return (
          <>
            <section className="net-worth">
              <div>
                <span>{month.replace("-", "년 ")}월 말 순자산</span>
                <strong>
                  {assetTotal - liabilityTotal < 0 ? "−" : ""}
                  {won(assetTotal - liabilityTotal)}
                </strong>
              </div>
              <aside>
                <span>자산</span>
                <b>{won(assetTotal)}</b>
                <i />
                <span>부채</span>
                <b>{won(liabilityTotal)}</b>
              </aside>
            </section>
            <section className="balance-grid">
              <BalanceGroup
                heading="자산"
                groups={groups("asset")}
                amounts={amounts}
              />
              <BalanceGroup
                heading="부채"
                groups={liabilityGroups}
                amounts={amounts}
              />
            </section>
          </>
        );
      }}
    </AppShell>
  );
}

function BalanceGroup({
  heading,
  groups,
  amounts,
}: {
  heading: string;
  groups: ImportedAccount[][];
  amounts: Map<string, number>;
}) {
  return (
    <article className="balance-surface">
      <header>
        <h2>{heading}</h2>
      </header>
      {groups.map((group) => (
        <section
          key={`${group[0].majorCategory}-${group[0].minorCategory}`}
          className="balance-group"
        >
          <div className="balance-group-head">
            <b>
              {group[0].type === "card"
                ? group[0].minorCategory.includes("할부")
                  ? "할부"
                  : "일시불"
                : group[0].majorCategory}
            </b>
            <strong>
              {won(
                group.reduce(
                  (sum, account) =>
                    sum + Math.abs(amounts.get(account.id) ?? 0),
                  0,
                ),
              )}
            </strong>
          </div>
          {group.map((account) => (
            <div className="balance-account" key={account.id}>
              <span>{account.name}</span>
              <b>{won(amounts.get(account.id) ?? 0)}</b>
            </div>
          ))}
        </section>
      ))}
    </article>
  );
}

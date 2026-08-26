"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  accountDetails,
  calculateAccountBalances,
  hydrateLedgerSettings,
  initialTransactions,
  type AccountDetails,
  type Transaction,
  won,
} from "@/lib/ledger";
import { readSharedState } from "@/lib/shared-state";

export default function BalancePage() {
  const [records, setRecords] = useState<Transaction[]>(initialTransactions);
  const [, setSettingsVersion] = useState(0);
  useEffect(() => {
    void readSharedState("transactions", initialTransactions).then(setRecords);
    void readSharedState("settings", { accounts: [], categories: [] }).then(
      (settings) => {
        hydrateLedgerSettings(settings);
        setSettingsVersion((version) => version + 1);
      },
    );
  }, []);
  return (
    <AppShell>
      {({ month }) => {
        const cutoff = `${month}-31`;
        const amounts = calculateAccountBalances(
          accountDetails,
          records,
          cutoff,
        );
        const scoped = accountDetails;
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
          const order = (account: AccountDetails) =>
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
                <b>
                  {assetTotal < 0 ? "−" : ""}
                  {won(assetTotal)}
                </b>
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
  groups: AccountDetails[][];
  amounts: Map<string, number>;
}) {
  const signedAssets = heading === "자산";
  const displayAmount = (amount: number) =>
    `${signedAssets && amount < 0 ? "−" : ""}${won(amount)}`;
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
              {displayAmount(
                group.reduce((sum, account) => {
                  const amount = amounts.get(account.id) ?? 0;
                  return sum + (signedAssets ? amount : Math.abs(amount));
                }, 0),
              )}
            </strong>
          </div>
          {group.map((account) => (
            <div className="balance-account" key={account.id}>
              <span>{account.name}</span>
              <b>{displayAmount(amounts.get(account.id) ?? 0)}</b>
            </div>
          ))}
        </section>
      ))}
    </article>
  );
}

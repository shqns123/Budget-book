from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
data = json.loads((ROOT / "data" / "imported-ledger.json").read_text(encoding="utf-8"))
output = ROOT / "drizzle" / "0003_import_source_ledger.sql"


def value(item):
    if item is None:
        return "NULL"
    if isinstance(item, bool):
        return "TRUE" if item else "FALSE"
    if isinstance(item, (int, float)):
        return str(int(item))
    return "'" + str(item).replace("'", "''") + "'"


lines = [
    "-- Generated from the user-authorized household spreadsheet.",
    "-- This replaces any app seed data with the spreadsheet source of truth.",
    "TRUNCATE TABLE transactions, budgets, categories, accounts, household_settings RESTART IDENTITY CASCADE;",
    "",
    "INSERT INTO household_settings (id, start_year, fiscal_start_month) VALUES",
    f"({value('8a6be571-29c5-4d6d-81a1-65a3318f68f3')}, {value(data['settings']['startYear'])}, {value(data['settings']['fiscalStartMonth'])});",
    "",
]

for account in data["accounts"]:
    fields = [account[key] for key in ("id", "name", "type", "classification", "majorCategory", "minorCategory", "accountCode", "openingBalance", "memo", "isHidden", "color", "paymentDay")]
    lines.append(
        "INSERT INTO accounts (id, name, type, classification, major_category, minor_category, account_code, opening_balance, memo, is_hidden, color, payment_day) VALUES ("
        + ", ".join(value(field) for field in fields)
        + ");"
    )

for category in data["categories"]:
    fields = [category[key] for key in ("id", "transactionType", "majorCategory", "minorCategory", "isFixed", "sortOrder", "isHidden")]
    lines.append(
        "INSERT INTO categories (id, transaction_type, major_category, minor_category, is_fixed, sort_order, is_hidden) VALUES ("
        + ", ".join(value(field) for field in fields)
        + ");"
    )

for transaction in data["transactions"]:
    fields = [transaction[key] for key in ("id", "accountId", "toAccountId", "transferGroupId", "date", "type", "category", "minorCategory", "amount", "memo", "isFixed")]
    lines.append(
        "INSERT INTO transactions (id, account_id, to_account_id, transfer_group_id, transaction_date, type, category, minor_category, amount, memo, is_fixed) VALUES ("
        + ", ".join(value(field) for field in fields)
        + ");"
    )

output.write_text("\n".join(lines) + "\n", encoding="utf-8")
print(f"{output.name}: {len(data['accounts'])} accounts, {len(data['categories'])} categories, {len(data['transactions'])} transactions")

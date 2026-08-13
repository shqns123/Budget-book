CREATE TYPE "public"."account_classification" AS ENUM('asset', 'short_liability', 'long_liability');--> statement-breakpoint
ALTER TYPE "public"."account_type" ADD VALUE 'loan' BEFORE 'savings';--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_type" "transaction_type" DEFAULT 'expense' NOT NULL,
	"major_category" text NOT NULL,
	"minor_category" text NOT NULL,
	"is_fixed" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "household_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"start_year" integer NOT NULL,
	"fiscal_start_month" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "classification" "account_classification" DEFAULT 'asset' NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "major_category" text NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "minor_category" text NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "account_code" text NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "opening_balance" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "memo" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "is_hidden" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "payment_day" integer;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "to_account_id" uuid;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "transfer_group_id" uuid;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_to_account_id_accounts_id_fk" FOREIGN KEY ("to_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
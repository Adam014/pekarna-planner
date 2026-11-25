CREATE TABLE "product" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"price" integer NOT NULL,
	"daily_limit" integer NOT NULL,
	"buffer" integer DEFAULT 0 NOT NULL,
	"bake_days" smallint[] NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_name_check" CHECK (btrim("product"."name") <> ''),
	CONSTRAINT "product_price_check" CHECK ("product"."price" >= 0),
	CONSTRAINT "product_daily_limit_check" CHECK ("product"."daily_limit" > 0),
	CONSTRAINT "product_buffer_check" CHECK ("product"."buffer" >= 0),
	CONSTRAINT "product_bake_days_check" CHECK ("product"."bake_days" <@ '{1,2,3,4,5,6,7}'::smallint[] and cardinality("product"."bake_days") > 0 and array_ndims("product"."bake_days") = 1)
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"order_cutoff_time" time DEFAULT '18:00' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settings_single_row_check" CHECK ("settings"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "customer" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_phone_unique" UNIQUE("phone"),
	CONSTRAINT "customer_name_check" CHECK (btrim("customer"."name") <> ''),
	CONSTRAINT "customer_phone_check" CHECK ("customer"."phone" ~ '^\+[1-9][0-9]{6,14}$')
);
--> statement-breakpoint
CREATE TABLE "reservation" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"customer_id" uuid NOT NULL,
	"customer_name" text NOT NULL,
	"customer_phone" text NOT NULL,
	"pickup_date" date NOT NULL,
	"pickup_time" time,
	"status" text DEFAULT 'reserved' NOT NULL,
	"source" text NOT NULL,
	"note" text,
	"standing_order_id" uuid,
	"created_by_user_id" text,
	"access_token_hash" text,
	"idempotency_key" uuid,
	"request_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reservation_access_token_hash_unique" UNIQUE("access_token_hash"),
	CONSTRAINT "reservation_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "reservation_standing_order_day_unique" UNIQUE("standing_order_id","pickup_date"),
	CONSTRAINT "reservation_status_check" CHECK ("reservation"."status" in ('reserved', 'picked_up', 'no_show', 'cancelled')),
	CONSTRAINT "reservation_source_check" CHECK ("reservation"."source" in ('phone', 'online', 'standing_order')),
	CONSTRAINT "reservation_phone_has_staff_check" CHECK (("reservation"."source" = 'phone') = ("reservation"."created_by_user_id" is not null)),
	CONSTRAINT "reservation_online_has_link_check" CHECK (("reservation"."source" = 'online') = ("reservation"."access_token_hash" is not null)),
	CONSTRAINT "reservation_standing_order_check" CHECK (("reservation"."source" = 'standing_order') = ("reservation"."standing_order_id" is not null)),
	CONSTRAINT "reservation_idempotency_check" CHECK (("reservation"."source" = 'standing_order') = ("reservation"."idempotency_key" is null) and ("reservation"."idempotency_key" is null) = ("reservation"."request_hash" is null)),
	CONSTRAINT "reservation_customer_name_check" CHECK (btrim("reservation"."customer_name") <> ''),
	CONSTRAINT "reservation_customer_phone_check" CHECK ("reservation"."customer_phone" ~ '^\+[1-9][0-9]{6,14}$'),
	CONSTRAINT "reservation_request_hash_check" CHECK ("reservation"."request_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "reservation_access_token_hash_check" CHECK ("reservation"."access_token_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "reservation_item" (
	"reservation_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"product_name" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" integer NOT NULL,
	CONSTRAINT "reservation_item_reservation_id_product_id_pk" PRIMARY KEY("reservation_id","product_id"),
	CONSTRAINT "reservation_item_product_name_check" CHECK (btrim("reservation_item"."product_name") <> ''),
	CONSTRAINT "reservation_item_quantity_check" CHECK ("reservation_item"."quantity" > 0),
	CONSTRAINT "reservation_item_unit_price_check" CHECK ("reservation_item"."unit_price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "standing_order" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"customer_id" uuid NOT NULL,
	"weekdays" smallint[] NOT NULL,
	"pickup_time" time,
	"note" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "standing_order_weekdays_check" CHECK ("standing_order"."weekdays" <@ '{1,2,3,4,5,6,7}'::smallint[] and cardinality("standing_order"."weekdays") > 0 and array_ndims("standing_order"."weekdays") = 1)
);
--> statement-breakpoint
CREATE TABLE "standing_order_item" (
	"standing_order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	CONSTRAINT "standing_order_item_standing_order_id_product_id_pk" PRIMARY KEY("standing_order_id","product_id"),
	CONSTRAINT "standing_order_item_quantity_check" CHECK ("standing_order_item"."quantity" > 0)
);
--> statement-breakpoint
ALTER TABLE "reservation" ADD CONSTRAINT "reservation_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation" ADD CONSTRAINT "reservation_standing_order_id_standing_order_id_fk" FOREIGN KEY ("standing_order_id") REFERENCES "public"."standing_order"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation" ADD CONSTRAINT "reservation_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_item" ADD CONSTRAINT "reservation_item_reservation_id_reservation_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_item" ADD CONSTRAINT "reservation_item_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standing_order" ADD CONSTRAINT "standing_order_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standing_order_item" ADD CONSTRAINT "standing_order_item_standing_order_id_standing_order_id_fk" FOREIGN KEY ("standing_order_id") REFERENCES "public"."standing_order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standing_order_item" ADD CONSTRAINT "standing_order_item_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "product_name_unique_idx" ON "product" USING btree (lower(btrim("name")));--> statement-breakpoint
CREATE INDEX "reservation_pickup_date_status_idx" ON "reservation" USING btree ("pickup_date","status");--> statement-breakpoint
CREATE INDEX "reservation_customer_id_idx" ON "reservation" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "reservation_created_by_user_id_idx" ON "reservation" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "reservation_item_product_id_idx" ON "reservation_item" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "standing_order_customer_id_idx" ON "standing_order" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "standing_order_item_product_id_idx" ON "standing_order_item" USING btree ("product_id");
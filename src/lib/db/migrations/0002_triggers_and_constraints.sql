-- Hand-written: what the Drizzle schema cannot express (ADR 0007). Drizzle's
-- snapshots do not know about anything in this file.

-- updated_at on every UPDATE, also for changes made outside the app (SQL
-- console, scripts). Drizzle's $onUpdate would only cover the ORM.
CREATE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER settings_set_updated_at BEFORE UPDATE ON "settings"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER product_set_updated_at BEFORE UPDATE ON "product"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER customer_set_updated_at BEFORE UPDATE ON "customer"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER reservation_set_updated_at BEFORE UPDATE ON "reservation"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER standing_order_set_updated_at BEFORE UPDATE ON "standing_order"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint

-- The single settings row exists from the start and cannot be deleted; the
-- cutoff is read from it on every order.
INSERT INTO "settings" DEFAULT VALUES;
--> statement-breakpoint
CREATE FUNCTION keep_settings_row() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'the settings row cannot be deleted'
    USING ERRCODE = 'restrict_violation';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER settings_keep_row BEFORE DELETE ON "settings"
  FOR EACH ROW EXECUTE FUNCTION keep_settings_row();

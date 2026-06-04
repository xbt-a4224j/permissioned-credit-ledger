-- The Seam · push a NOTIFY the instant a reconciliation cycle commits · #22
-- The SSE recon source (#22) LISTENs on `recon_changed` so a NavAnomaly/ReconMismatch HALT (#18)
-- reaches the UI the moment the engine appends the recon_status row — not one poll later. The
-- trigger fires after every insert and carries the new cycle_id + ok flag as the payload; the
-- API also keeps a short poll fallback for when a pooled listener connection drops.
create or replace function recon_status_notify() returns trigger as $$
begin
  perform pg_notify('recon_changed', json_build_object('cycle', new.cycle_id, 'ok', new.ok)::text);
  return new;
end;
$$ language plpgsql;

drop trigger if exists recon_status_notify_trigger on recon_status;
create trigger recon_status_notify_trigger
  after insert on recon_status
  for each row execute function recon_status_notify();

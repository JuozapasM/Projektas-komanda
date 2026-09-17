begin;

-- Keep the audit log bounded and make both retention cleanup and newest-first reads efficient.
delete from public.reservation_events
where occurred_at < now() - interval '3 months';

create index reservation_events_occurred_at_id
on public.reservation_events (occurred_at desc, id desc);

commit;

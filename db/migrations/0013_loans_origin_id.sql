-- #66 origin_id: the warehouse string id (e.g. "L03857") a loan was tokenized from.
-- Nullable: the 6 seeded loans have none and keep displaying their numeric id ("#1".."#6");
-- runtime-tokenized loans store their warehouse id here so the marketplace shows it instead of
-- the numeric loans.id. Display-only; not a foreign key (wh_book lives in the warehouse sidecar).
alter table loans add column if not exists origin_id text;

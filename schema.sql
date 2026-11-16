-- Voertuigenlogboek: database-schema voor Supabase.
-- Plak dit hele bestand in Supabase > SQL Editor en kies Run. Het mag meerdere keren uitgevoerd worden.

create table if not exists public.interventies (
  id               uuid primary key default gen_random_uuid(),
  nummerplaat      text not null check (nummerplaat ~ '^[A-Z0-9]{2,12}$'),
  datum            date not null,
  soort            text not null check (soort in ('Onderhoud', 'Herstelling', 'Keuring', 'Overig')),
  omschrijving     text not null check (char_length(omschrijving) between 1 and 2000),
  onderdeel        text not null default '' check (char_length(onderdeel) <= 200),
  uitgevoerd_door  text not null check (char_length(uitgevoerd_door) between 1 and 100),
  kilometerstand   integer check (kilometerstand >= 0 and kilometerstand <= 5000000),
  voertuig         text not null default '' check (char_length(voertuig) <= 200),
  aangemaakt_op    timestamptz not null default now(),
  aangemaakt_door  uuid default auth.uid() references auth.users (id) on delete set null
);

create index if not exists interventies_plaat_datum_idx on public.interventies (nummerplaat, datum desc);

-- Beveiliging: alleen aangemelde gebruikers hebben toegang, anonieme bezoekers helemaal niet.
alter table public.interventies enable row level security;

revoke all on public.interventies from anon;
revoke all on public.interventies from authenticated;
grant select, insert, delete on public.interventies to authenticated;

drop policy if exists "lezen" on public.interventies;
create policy "lezen" on public.interventies
  for select to authenticated using (true);

drop policy if exists "toevoegen" on public.interventies;
create policy "toevoegen" on public.interventies
  for insert to authenticated with check (aangemaakt_door = auth.uid());

-- Iedereen kan alleen zijn eigen invoer verwijderen. Een beheerder kan in het dashboard alles aanpassen.
drop policy if exists "eigen verwijderen" on public.interventies;
create policy "eigen verwijderen" on public.interventies
  for delete to authenticated using (aangemaakt_door = auth.uid());

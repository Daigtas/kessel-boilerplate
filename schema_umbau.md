<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# ok, bitte verfasse einen anleitung, die ich curser geben kann und am agent in beiden codebases hinterlegen kann. und dann beginne ich in der boilerplate base

Hier ist ein Text, den du 1:1 als Anleitung/„System-Prompt“ in Cursor für beide Repos hinterlegen kannst (Boilerplate und kessel‑cli). Passe nur die Projektpfade/Namen an.

***

## Anleitung für Cursor: Migration von Schema‑Multi‑Tenant zu RLS‑Multi‑Tenant in Supabase

Du arbeitest in einem Supabase‑Projekt, das aktuell Mandanten über **separate Schemas** trennt. Ziel ist, auf ein **Single‑Schema‑Design mit `tenant_id` + RLS** umzubauen, um `pgrst.db_schemas`‑Probleme zu vermeiden und alles vollautomatisierbar zu machen.[^1][^2]

### Gesamtziel

- Nur noch **ein App‑Schema** (z.B. `app` oder `treebuilder` / `public`) für Geschäftslogik.[^3]
- Eine zentrale `infra.tenants`‑Tabelle.[^4]
- Jede mandantenfähige Tabelle bekommt eine Spalte `tenant_id` (FK auf `infra.tenants.id`).[^5][^4]
- RLS sorgt dafür, dass ein User nur Daten seines Tenants sieht: `tenant_id = current_tenant_id()`.[^2][^6]
- Die CLI (kessel‑cli) legt in Zukunft **keine neuen Schemas** pro Tenant mehr an, sondern neue Tenant‑Rows + Default‑Daten.

***

## 1. Kontext der Boilerplate-Codebase

- Projekt: **Kessel‑Boilerplate / Vorlagenprojekt** (hier liegt die „Infra‑Wahrheit“).
- Supabase‑Artefakte findest du typischerweise unter:
    - `supabase/` oder `infra/` oder `db/` (bitte zuerst Projekt durchsuchen).[^7]
    - Interessant sind:
        - Migrations (`supabase/migrations/*` oder ähnliche Struktur)
        - Seed‑Skripte
        - RPC‑Funktionen / SQL‑Views
        - Dokumentation für Tenant‑Schemas (z.B. `treebuilder`, `galaxy`, `sandbox` etc.).

**Aufgabe für dich (Cursor) in dieser Codebase:**

1. Finde alle Stellen, an denen mehrere Schemas für Mandanten genutzt werden (z.B. `CREATE SCHEMA`, Grants, RPC für Schema‑Erstellung).
2. Erzeuge schrittweise Migrations, um auf das neue RLS‑Design umzusteigen (siehe unten).
3. Passe Beispiel‑App / Supabase‑Clientzugriffe an, sodass kein `.schema('<tenant_schema>')` mehr verwendet wird, sondern nur noch `from('<table>')` + RLS.[^8][^9]

***

## 2. Zielarchitektur im Detail

### 2.1 Tenant-Modell

Erzeuge folgende Struktur (oder passe an, falls bereits ähnlich vorhanden):

```sql
-- 1) Tenants
create table if not exists infra.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null, -- z.B. "alpha", "demo", "customer-x"
  name text not null,
  created_at timestamptz not null default now()
);

-- 2) Hilfsfunktion: aktueller Tenant aus dem JWT
create or replace function infra.current_tenant_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb->>'tenant_id', '')::uuid
$$;
```

- Wichtig: `tenant_id` muss später im JWT stehen (`jwt.claims.tenant_id`). Das wird im zweiten Schritt über Auth‑/CLI‑Anpassungen erledigt.[^10][^11]

Optional (falls mehrere Tenants pro User):

```sql
create table if not exists infra.user_tenants (
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid not null references infra.tenants(id) on delete cascade,
  role text not null default 'member',
  primary key (user_id, tenant_id)
);
```


### 2.2 App-Tabellen mit `tenant_id`

Für jede Tabelle, die bisher pro Tenant‑Schema existiert, führen wir eine zentrale Tabelle ein. Beispiel:

Bisher:

- `treebuilder.projects`
- `galaxy.projects`

Ziel:

```sql
create schema if not exists app;

create table if not exists app.projects (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references infra.tenants(id),
  name text not null,
  created_at timestamptz not null default now()
  -- weitere Spalten ...
);

create index if not exists projects_tenant_id_idx
  on app.projects (tenant_id);
```

Bitte:

- Für alle relevanten Tabellen solche zentralen Tabellen erzeugen.
- Immer `tenant_id` + sinnvolle Indexe anlegen.[^12][^5]


### 2.3 RLS für `tenant_id`

Aktiviere RLS und setze Policies, die auf `infra.current_tenant_id()` filtern:

```sql
alter table app.projects enable row level security;

create policy "tenant_read_projects"
  on app.projects
  for select
  using (tenant_id = infra.current_tenant_id());

create policy "tenant_write_projects"
  on app.projects
  for insert, update, delete
  using (tenant_id = infra.current_tenant_id())
  with check (tenant_id = infra.current_tenant_id());
```

Optional: Trigger, der `tenant_id` automatisch setzt:

```sql
create or replace function app.set_tenant_id()
returns trigger
language plpgsql
as $$
begin
  if new.tenant_id is null then
    new.tenant_id := infra.current_tenant_id();
  end if;
  return new;
end;
$$;

create trigger set_tenant_id_before_insert
  before insert on app.projects
  for each row execute function app.set_tenant_id();
```


***

## 3. Datenmigration Schema → RLS

Sobald Zieltabellen existieren, müssen die Daten aus den bisherigen Tenant‑Schemas migriert werden.

Angenommen es gibt bisher Schemas wie `treebuilder`, `galaxy`, `sandbox` mit jeweils `projects`:

1. Für jedes Tenant-Schema einen Eintrag in `infra.tenants` anlegen:
```sql
insert into infra.tenants (slug, name)
values
  ('treebuilder', 'Treebuilder Tenant'),
  ('galaxy', 'Galaxy Tenant'),
  ('sandbox', 'Sandbox Tenant')
on conflict (slug) do nothing;
```

2. Migration pro Schema:
```sql
-- Beispiel: treebuilder.projects -> app.projects
insert into app.projects (id, tenant_id, name, created_at)
select
  p.id,
  t.id as tenant_id,
  p.name,
  p.created_at
from treebuilder.projects p
join infra.tenants t on t.slug = 'treebuilder';
```

Bitte:

- Entsprechende `INSERT ... SELECT ...`‑Statements für alle relevanten Tabellen generieren.
- IDs und Fremdschlüssel beibehalten, sodass App‑Logik weiter funktioniert.
- Diese Migrationen als saubere Supabase‑Migrationsdateien anlegen.[^7]

***

## 4. Anpassung des App-Codes (Boilerplate)

Wenn die neue Struktur steht, passe die App‑Codebase an:

- Entferne überall `.schema('<tenant_schema>')` beim `supabase`‑Client.[^9][^8]
- Nutze einfach `supabase.from('projects')...` (oder `from('app.projects')` je nach Namenskonvention).
- Verlasse dich darauf, dass:
    - `tenant_id` automatisch gesetzt wird (Trigger)
    - RLS über `infra.current_tenant_id()` filtert.

Die Tenant‑Auswahl im Frontend darf nur noch steuern, **welcher Token** bzw. welches `tenant_id` im JWT verwendet wird, nicht mehr das Schema.

***

## 5. Anpassung der kessel-cli Codebase (zweite Phase)

Wenn das Boilerplate‑Projekt fertig umgestellt und getestet ist:

Öffne die **kessel‑cli** Codebase und passe die Automatisierung an:

1. Statt „Schema pro Tenant anlegen“ soll die CLI:
    - Einen Datensatz in `infra.tenants` anlegen (Slug und Name).
    - Optional Default‑Daten in `app.*`‑Tabellen für diesen Tenant insertieren (z.B. ein „Welcome‑Projekt“).
2. Beim Einrichten eines Users:
    - `tenant_id` diesem User zuordnen:
        - Entweder direkt in `auth.users.app_metadata` oder über `infra.user_tenants`.[^13][^10]
    - Sicherstellen, dass `tenant_id` in den JWT‑Claims landet (Supabase Auth übernimmt das, wenn `app_metadata` korrekt gesetzt ist).[^11][^2]
3. Keine CLI‑Operation darf mehr versuchen:
    - `CREATE SCHEMA <tenant>`
    - `ALTER ROLE authenticator SET pgrst.db_schemas = ...`

Stattdessen: alles über `tenant_id` + RLS.

***

## 6. Wichtige Fallstricke

Bitte achte besonders auf:

- **Vollständigkeit der Migration**:
    - Alle Tabellen, die tenant‑spezifische Daten enthalten, brauchen `tenant_id` und RLS.[^4][^12]
- **Performance**:
    - `tenant_id` immer indexieren.
    - RLS‑Policies so einfach wie möglich halten.[^5][^12]
- **Admin‑Usecases**:
    - Wenn es Admins mit globaler Sicht gibt, separate Policies (z.B. basierend auf `jwt.claims.role = 'platform_admin'`).[^6][^14]

***

## Arbeitsweise

Bitte:

1. Zuerst alle relevanten SQL‑/Migrations‑Dateien im Boilerplate‑Repo identifizieren und einen Überblick geben.
2. Danach schrittweise Migrationsdateien erzeugen:
    - `infra.tenants` + `infra.current_tenant_id()`
    - zentrale `app.*`‑Tabellen + `tenant_id`
    - RLS‑Policies
    - Datenmigration von bisherigen Tenant‑Schemas
3. Danach im App‑Code `.schema(... )`‑Verwendungen entfernen und auf RLS‑Modell umstellen.
4. Erst wenn das Boilerplate funktioniert, die kessel‑cli Codebase öffnen und die CLI‑Logik anpassen.

***

Diesen Text kannst du als „Projektanleitung“ in beiden Repos bei Cursor hinterlegen. Starte dann im Boilerplate‑Repo mit:

> „Analysiere bitte alle Supabase‑Migrations und zeig mir, wo derzeit mehrere Schemas verwendet werden. Danach wollen wir auf das oben beschriebene RLS‑Tenant‑Modell migrieren.“

<div align="center">⁂</div>

[^1]: https://github.com/orgs/supabase/discussions/1615

[^2]: https://supabase.com/docs/guides/database/postgres/row-level-security

[^3]: https://supabase.com/docs/guides/api/using-custom-schemas

[^4]: https://www.antstack.com/blog/multi-tenant-applications-with-rls-on-supabase-postgress/

[^5]: https://www.leanware.co/insights/supabase-best-practices

[^6]: https://github.com/orgs/community/discussions/149922

[^7]: https://supabase.com/docs/guides/local-development/overview

[^8]: https://github.com/orgs/supabase/discussions/1222

[^9]: https://github.com/orgs/supabase/discussions/21511

[^10]: https://roughlywritten.substack.com/p/supabase-multi-tenancy-simple-and

[^11]: https://supabase.com/docs/guides/api/securing-your-api

[^12]: https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv

[^13]: https://github.com/dikshantrajput/supabase-multi-tenancy

[^14]: https://dev.to/asheeshh/mastering-supabase-rls-row-level-security-as-a-beginner-5175


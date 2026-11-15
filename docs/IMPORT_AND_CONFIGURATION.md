# Import & setup — quick reference

### GitHub

Extract ZIP → copy **all** files including `src/`, `package.json`, `ww-config.js` into your new GitHub repository → push to `main`.

### WeWeb

Workspace settings → connect GitHub → Dashboard → Coded components → **Import element** → select repo/branch → activate built version → WeWeb page **Template Builder** → Add → Coded components → drag element onto page.

### Properties to set inside WeWeb (not in GitHub)

| Property | Example | Notes |
|---|---|---|
| Supabase Project URL | `https://xxxxx.supabase.co` | Exact project origin, not `/rest/v1` |
| Supabase Publishable Key | `sb_publishable_xxxxx` | Only public key; never service role |
| Actor user_profiles.id | `1` | Must correspond to a real row; example only |
| Enable development writes | `true` | Private dev only; default false |
| Enable publication | `false` | Keep off until review snapshot integrated; default false |
| Initial Template Version ID | `0` | Optional, auto-select if 0 |

Click **Refresh** after configuring. If HTTP 401/403 appears, inspect Supabase Data API/grants rather than pasting a secret key.

### Project status

This is the one integrated **Page 2** component. It is separate from the **All Templates** component and is **not** a full replacement for the Central Console shell. It fits into the existing Page 2 content region.

### Updated version later

Bump `package.json` version, push to GitHub, fetch the component's latest version, and activate it in WeWeb. Verify changes in a development workspace first.

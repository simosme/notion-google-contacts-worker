# Notion Google Contacts Worker

A [Notion Worker](https://developers.notion.com/workers/get-started/overview) that syncs your **Google Contacts** into a managed Notion database every **3 hours**.

- **One-way sync:** Google → Notion (contacts removed in Google are removed from Notion on the next full sync)
- **Hosted by Notion:** no servers or cron jobs to run yourself
- **OAuth:** Google authorization is handled by the Workers runtime

> **Beta:** Notion Workers is in beta. APIs, CLI commands, and hosting behavior may change. See the [Workers documentation](https://developers.notion.com/workers/get-started/overview).

## Prerequisites

- A Notion workspace with **Workers** enabled (Business or Enterprise; workspace owner must enable Workers)
- [Node.js](https://nodejs.org/) 22+
- The [Notion CLI](https://developers.notion.com/cli/get-started/overview) (`ntn`)
- A [Google Cloud](https://console.cloud.google.com/) project with the **People API** enabled

## Quick start

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/notion-google-contacts-worker.git
cd notion-google-contacts-worker
npm install
```

### 2. Install the Notion CLI

```bash
curl -fsSL https://ntn.dev | bash
ntn login
```

On Windows, follow the [CLI installation docs](https://developers.notion.com/cli/get-started/overview) if the install script is not available.

### 3. Deploy the worker (first time)

From the project directory:

```bash
ntn workers deploy
```

This registers the worker with your Notion workspace. OAuth credentials are not required yet.

### 4. Google Cloud setup

1. Create or select a Google Cloud project.
2. Enable the **[People API](https://console.cloud.google.com/apis/library/people.googleapis.com)**.
3. Configure the **[OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent)** (External or Internal as appropriate).
4. Create an **OAuth 2.0 Client ID** (application type: **Web application**).
5. Get the Notion redirect URL:

   ```bash
   ntn workers oauth show-redirect-url
   ```

6. Add that URL as an **Authorized redirect URI** on your Google OAuth client.
7. Copy the **Client ID** and **Client secret**.

Required OAuth scope (requested by this worker):

- `https://www.googleapis.com/auth/contacts.readonly`

### 5. Store secrets and redeploy

```bash
ntn workers env set GOOGLE_CLIENT_ID=your-client-id GOOGLE_CLIENT_SECRET=your-client-secret
ntn workers deploy
```

### 6. Authorize Google

```bash
ntn workers oauth start googleAuth
```

Complete the browser flow to grant read access to your contacts.

### 7. Run a sync

Preview without writing to Notion:

```bash
ntn workers sync trigger contactsSync --preview
```

Run a real sync immediately:

```bash
ntn workers sync trigger contactsSync
```

Check sync status:

```bash
ntn workers sync status
```

After the first successful sync, Notion creates a **Google Contacts** database in your workspace. The worker runs automatically every **3 hours**.

## What gets synced

Each Google contact becomes one row with:

| Notion property | Source |
|-----------------|--------|
| Name | Primary display name |
| Contact ID | Google `resourceName` (stable key) |
| Email | Primary email |
| Phone | Primary phone |
| Company | Primary organization (name and title) |
| Photo URL | Primary photo URL |

## Development

```bash
npm run check   # TypeScript type-check
npm run build   # Emit dist/
```

Pull secrets for local testing (includes a refreshed OAuth token):

```bash
ntn workers env pull
```

See [`.env.example`](.env.example) for variable names. Never commit `.env`.

## Schedule and sync behavior

- **Schedule:** `3h` (every 3 hours), configured on the `contactsSync` capability in [`src/index.ts`](src/index.ts).
- **Mode:** `replace` — each full sync cycle paginates through all Google contacts; records not seen in that cycle are deleted from Notion.
- **Pagination:** 100 contacts per API page; the sync resumes with `pageToken` until `hasMore` is false.

For very large address books, consider switching to `incremental` mode and Google’s `syncToken` API (see [People API contacts guide](https://developers.google.com/people/v1/contacts)).

## Useful CLI commands

```bash
ntn workers deploy
ntn workers sync trigger contactsSync
ntn workers sync trigger contactsSync --preview
ntn workers sync status
ntn workers sync state reset contactsSync
ntn workers capabilities disable contactsSync
ntn workers capabilities enable contactsSync
ntn workers runs logs <runId>
```

## Security

- Do **not** commit `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, or `.env`.
- Each user deploys this worker to **their own** Notion workspace and authorizes **their own** Google account.
- OAuth tokens are stored by the Notion Workers runtime, not in this repository.

## License

MIT — see [LICENSE](LICENSE).

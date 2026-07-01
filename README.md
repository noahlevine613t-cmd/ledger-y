# Ledgerly Payment Tracker

A responsive, browser-based dashboard for tracking vendor payment requests from initial request through approval, scheduling, and payment.

## Run locally

Run `start-dashboard.ps1`, then open `http://localhost:4173`. The app stores added requests and updates in browser local storage.

## Included

- Request aging and attention alerts
- Outstanding and paid summaries
- Search and status/age filters
- Request details and activity timeline
- Last balance sent tracking
- Status advancement workflow
- New request form
- CSV export
- Responsive layout

## Connect Microsoft Outlook

1. In the [Microsoft Entra admin center](https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade), create an app registration named **Ledgerly Payment Tracker**.
2. Choose the supported account type that matches your organization—normally **Accounts in this organizational directory only**.
3. Under **Authentication**, add a **Web** redirect URI: `http://localhost:4173/auth/outlook/callback`.
4. Under **API permissions**, add delegated Microsoft Graph permissions: `User.Read` and `Mail.Read`.
5. Under **Certificates & secrets**, create a client secret for local testing and copy its **Value** immediately.
6. Copy `.env.example` to `.env`, then fill in the Application (client) ID, Directory (tenant) ID, and client secret value.
7. Restart `start-dashboard.ps1` and select **Connect inbox**.

The connection uses Microsoft's authorization code flow with PKCE. `Mail.Read` is read-only—the app cannot send, modify, or delete email. Tokens stay in server memory and are cleared when the server restarts. For production, use encrypted persistent token storage and a certificate or managed identity instead of a client secret.

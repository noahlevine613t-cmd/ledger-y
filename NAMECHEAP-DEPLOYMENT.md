# Deploy Ledgerly on Namecheap Stellar

## 1. Create the subdomain

In cPanel, open **Domains** and create `app.aptracker.space`. Keep HTTPS enabled and wait for Namecheap's SSL certificate to become active.

## 2. Create the Node.js application

In cPanel, open **Setup Node.js App** and choose **Create application**:

- Node.js version: `22` or `24`
- Application mode: `Production`
- Application root: `ledgerly`
- Application URL: `https://app.aptracker.space`
- Application startup file: `server.js`

## 3. Upload Ledgerly

Upload and extract the contents of `ledgerly-namecheap.zip` into the application root created by cPanel. The files such as `server.js`, `index.html`, and `package.json` should sit directly inside that root—not inside another nested folder.

## 4. Add environment variables

In **Setup Node.js App**, add these variables. Never upload a `.env` file containing the secret.

- `NODE_ENV` = `production`
- `ALLOW_CONFIG_UI` = `false`
- `MICROSOFT_CLIENT_ID` = the Application (client) ID from Entra
- `MICROSOFT_TENANT_ID` = the Directory (tenant) ID from Entra
- `MICROSOFT_CLIENT_SECRET` = the client secret **Value** from Entra
- `MICROSOFT_REDIRECT_URI` = `https://app.aptracker.space/auth/outlook/callback`
- `OUTLOOK_LOGIN_HINT` = `nlevine@mintpurchasing.com`

Do not set `PORT`; Namecheap assigns the application port.

## 5. Update Microsoft Entra

In the Ledgerly app registration, open **Authentication**. Under the Web platform, add:

`https://app.aptracker.space/auth/outlook/callback`

Keep the localhost redirect URI as well if you want the local copy to continue working.

Under **API permissions**, add delegated Microsoft Graph permissions `User.Read` and `Mail.Read`.

## 6. Start and verify

Return to **Setup Node.js App**, run **NPM Install** if offered, and choose **Restart**. Visit `https://app.aptracker.space`, select **Connect inbox**, and approve Microsoft's read-only permission request.

## Important limitation

This first hosted version keeps payment requests in each browser's local storage and Outlook tokens in server memory. A server restart requires reconnecting Outlook. Before adding multiple users or relying on it as a permanent system of record, add a database, encrypted token storage, and application-level access control.

## GitHub updates

The included `.cpanel.yml` deploys the five application files to `/home/apthrue/ledgerly/` and touches `tmp/restart.txt` so Passenger reloads the application.

In cPanel **Git Version Control**, clone the GitHub repository into a separate path such as `/home/apthrue/repositories/ledgerly`. Do not clone it directly into the live application root. For each release, open **Manage → Pull or Deploy**, select **Update from Remote**, then **Deploy HEAD Commit**.

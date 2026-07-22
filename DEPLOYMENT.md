# Shogun's Ascent on DigitalOcean

Target URL: `https://shogun.thehappysamurai.com`

## Architecture

- Existing Droplet and n8n stay in place.
- Shogun's Ascent runs in its own Docker container on `127.0.0.1:3002`.
- The existing reverse proxy terminates HTTPS and forwards the Shogun subdomain to port `3002`.
- SQLite lives in `deployment-data/`, outside the container.

## First deployment

1. Create the DNS `A` record `shogun` pointing to the Droplet IP.
2. Copy `.env.production.example` to `.env.production` and generate a unique 64+ character `JWT_SECRET`.
3. Create the clean production database without altering the local database:

   ```powershell
   npm run prepare:production-db
   ```

   The output keeps the sole admin account and app settings, and removes all other users, games, snapshots, friendships, and waiting lobbies.

4. Upload the repository and `deployment-data/games.db` to the Droplet.
5. Start it:

   ```bash
   docker compose --env-file .env.production -f docker-compose.shogun.yml up -d --build
   ```

6. Add the HTTPS reverse-proxy route from `shogun.thehappysamurai.com` to `http://127.0.0.1:3002`. WebSocket upgrade headers must be enabled.

## Backups

- Enable daily DigitalOcean Droplet backups as the first recovery layer. DigitalOcean retains the basic daily plan for seven days; convert milestone backups to snapshots when a longer-lived full-server image is useful.
- Run `docker compose --env-file .env.production -f docker-compose.shogun.yml exec -T shoguns-ascent npm run backup:db` daily.
- Send the resulting `backups/games-*.db` files to an off-Droplet encrypted destination such as DigitalOcean Spaces through Restic.
- Suggested retention: 7 daily, 5 weekly, and 12 monthly copies.
- Test a restore quarterly in a temporary directory; a backup is only useful once restoration has been verified.

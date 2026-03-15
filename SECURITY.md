# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in lifeOS, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please email: **goyaleklavya@gmail.com**

Or use [GitHub's private vulnerability reporting](https://github.com/eklavyagoyal/lifeos/security/advisories/new).

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Response Timeline

- **Acknowledgment:** Within 48 hours
- **Assessment:** Within 1 week
- **Fix:** As soon as practical, depending on severity

## Security Model

lifeOS is designed as a **single-user, self-hosted** application. The security model reflects this:

### Authentication

- Passphrase-based authentication (bcrypt hashed)
- HMAC-SHA256 signed session tokens
- Session cookies with `httpOnly`, `secure`, and `sameSite` flags
- No passwords stored in plaintext

### Data Storage

- All data stored locally in SQLite
- No data transmitted to external services
- No telemetry or analytics
- Database file should be protected with filesystem permissions

### Network Security

- lifeOS is designed to run on a **trusted local network** or behind a **VPN/tunnel**
- If exposing to the internet, use a reverse proxy with HTTPS (see [docs/self-hosting.md](docs/self-hosting.md))
- The built-in auth protects against casual access but is not designed for hostile internet exposure

### Recommendations

1. **Always change the default passphrase** before first use
2. **Use HTTPS** if accessing over a network (via reverse proxy)
3. **Back up your database** regularly (Settings → Export & Backup)
4. **Restrict network access** — use Tailscale, Cloudflare Tunnel, or similar
5. **Keep your host OS updated** — lifeOS security depends on your host

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.x     | ✅        |
| < 1.0   | ❌        |

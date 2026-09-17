# Clerk Custom OAuth Scopes Setup Guide for MCP

Reference: [Clerk Changelog (2026-08-21)](https://clerk.com/changelog/2026-08-21-custom-oauth-scopes)  
Account: `blendly.tech@gmail.com`

---

## 1. Dashboard Configuration

Clerk requires authenticated browser access (Google SSO / OTP / password). Complete the following steps in your Clerk Dashboard:

1. **Log In**: Open [Clerk Dashboard](https://dashboard.clerk.com/~/oauth-applications) using `blendly.tech@gmail.com`.
2. **Navigate to Scopes**:
   - In the navigation bar, go to **OAuth Applications**.
   - Select the **Scopes** tab.
3. **Define Custom Scopes**:
   - Click **Add Scope** (or **Create Scope**).
   - Recommended scopes for MCP:
     - `tools:execute` — execute tools/actions
     - `messages:read` — read conversation logs/context
     - `resources/files:read` — read attached files/assets
     - `mcp_all` — full administrative access
4. **Advertise Scopes**:
   - Enable **Advertise scope** so MCP clients can discover supported permissions via Clerk's OAuth discovery endpoints (`/.well-known/oauth-authorization-server`).
5. **Assign Scopes**:
   - Select your target OAuth application.
   - Attach the granted scopes required for client requests.

---

## 2. Server Enforcement (MCP Server)

Clerk delivers the granted scopes in the access token. Your API or MCP server must verify the token and enforce scope authorization.

### Option A: Express / MCP Endpoint with `@clerk/mcp-tools`

```typescript
import express from 'express';
import { protectedResourceHandlerClerk } from '@clerk/mcp-tools';
import { clerkMiddleware, requireAuth } from '@clerk/express';

const app = express();

// Advertise supported scopes to MCP clients
app.get(
  '/.well-known/oauth-protected-resource/mcp',
  protectedResourceHandlerClerk({
    scopes_supported: ['tools:execute', 'messages:read', 'resources/files:read', 'mcp_all'],
  }),
);

// Enforce required scope on tool execution
app.post('/mcp/tools/call', clerkMiddleware(), (req, res) => {
  const auth = req.auth;
  if (!auth?.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Check if token contains required scope
  const grantedScopes: string[] = auth.sessionClaims?.scp ?? auth.claims?.scp ?? [];
  if (!grantedScopes.includes('tools:execute') && !grantedScopes.includes('mcp_all')) {
    return res.status(403).json({ error: 'Forbidden: Missing tools:execute scope' });
  }

  // Execute MCP tool logic...
  return res.json({ status: 'ok' });
});
```

### Option B: Token Verification via Clerk Backend API

```sh
curl https://api.clerk.com/oauth_applications/access_tokens/verify \
  -X POST \
  -H 'Authorization: Bearer <YOUR_CLERK_SECRET_KEY>' \
  -H 'Content-Type: application/json' \
  -d '{ "access_token": "<CLIENT_OAUTH_TOKEN>" }'
```

Response includes:
```json
{
  "client_id": "oauth_client_...",
  "user_id": "user_...",
  "scopes": ["tools:execute", "messages:read"]
}
```


# WhatsApp Connector Integration Guide

This guide explains how to use the WhatsApp connector in Milaidy with Baileys (QR code) authentication.

## Overview

As of `@elizaos/plugin-whatsapp@2.0.0-alpha.6`, the plugin supports two authentication methods:
- **Cloud API**: For business accounts using WhatsApp Business API
- **Baileys**: For personal accounts using QR code authentication (like WhatsApp Web)

## Quick Start with Baileys (QR Code)

### 1. Configuration

Create or modify your character configuration file to include the WhatsApp connector:

```json
{
  "name": "Your Bot Name",
  "connectors": {
    "whatsapp": {
      "enabled": true,
      "authMethod": "baileys",
      "authDir": "./auth/whatsapp",
      "printQRInTerminal": true,
      "dmPolicy": "pairing",
      "sendReadReceipts": true,
      "selfChatMode": false
    }
  }
}
```

### 2. Start Milaidy

```bash
npm start -- --character=./your-config.character.json
```

Or using the test configuration:

```bash
npm start -- --character=./whatsapp-test.character.json
```

### 3. Scan QR Code

When Milaidy starts, it will display a QR code in your terminal:

```
=== WhatsApp QR Code ===

█████████████████████████████████
█████████████████████████████████
███ ▄▄▄▄▄ █▀█ █▄▄▀▄█ ▄▄▄▄▄ ███
███ █   █ █▀▀▀█ ▀ ▄█ █   █ ███
███ █▄▄▄█ █▀ █▀▀█▀▀█ █▄▄▄█ ███
...

Scan the QR code with your WhatsApp mobile app
```

1. Open WhatsApp on your phone
2. Go to **Settings** > **Linked Devices**
3. Tap **Link a Device**
4. Scan the QR code displayed in your terminal

### 4. Connection Established

Once scanned, you'll see:

```
[WhatsApp] ✅ Connected to WhatsApp!
```

Your session will be saved in the `authDir` directory for future use.

## Configuration Options

### Baileys-Specific Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `authMethod` | string | `"baileys"` | Authentication method: `"baileys"` or `"cloudapi"` |
| `authDir` | string | Required | Directory to store session files |
| `printQRInTerminal` | boolean | `true` | Display QR code in terminal |
| `selfChatMode` | boolean | `false` | Enable responding to messages from your own number |
| `dmPolicy` | string | `"pairing"` | DM acceptance policy |
| `sendReadReceipts` | boolean | `true` | Send read receipts for received messages |
| `messagePrefix` | string | `""` | Prefix to add to all outgoing messages |

### Cloud API Options

For WhatsApp Business API (Cloud API), use these options instead:

```json
{
  "whatsapp": {
    "enabled": true,
    "authMethod": "cloudapi",
    "accessToken": "${WHATSAPP_ACCESS_TOKEN}",
    "phoneNumberId": "${WHATSAPP_PHONE_NUMBER_ID}",
    "webhookVerifyToken": "${WHATSAPP_WEBHOOK_VERIFY_TOKEN}",
    "businessAccountId": "${WHATSAPP_BUSINESS_ACCOUNT_ID}"
  }
}
```

## Session Persistence

When using Baileys authentication, your session is stored in the `authDir` directory. This includes:
- `creds.json` - WhatsApp credentials
- `app-state-sync-*` - Encryption keys and state
- `pre-key-*` - Pre-shared keys
- `device-list-*` - Linked device information

**Important**: Keep these files secure and do not commit them to version control. Add your auth directory to `.gitignore`:

```
auth/
```

## Reconnection

If you restart Milaidy with the same `authDir`, it will automatically reconnect using your saved session without requiring a new QR code scan.

## Troubleshooting

### QR Code Not Displaying
- Ensure `printQRInTerminal: true` in your config
- Check that your terminal supports Unicode characters
- Try a different terminal emulator if needed

### Connection Timeout
- QR codes expire after a short time
- Milaidy will automatically generate a new QR code if the previous one expires
- Make sure your phone has internet connectivity

### Session Expired
- Delete the contents of your `authDir`
- Restart Milaidy to generate a new QR code
- Link your device again

### Rate Limiting
- WhatsApp has rate limits for message sending
- The plugin implements automatic retry logic with exponential backoff
- Avoid sending messages too rapidly

## Testing Checklist

Based on issue [#147](https://github.com/milady-ai/milaidy/issues/147), the following features should be tested:

### Setup & Authentication
- [x] QR code authentication flow
- [x] Session persistence (authState/sessionPath)
- [ ] Reconnection after restart
- [ ] Clear error messaging during auth failures

### Message Handling
- [ ] Text message receiving
- [ ] Text message sending
- [ ] Long message handling (>280 chars)
- [ ] Message formatting support

### Platform-Specific Features
- [ ] Group messaging capabilities
- [ ] Reply quoting functionality
- [ ] Read receipts
- [ ] Typing indicators

### Media & Attachments
- [ ] Image reception
- [ ] Voice message reception
- [ ] Document reception
- [ ] Image transmission
- [ ] Document transmission

### Contacts & Groups
- [ ] One-to-one chat functionality
- [ ] Group chat functionality
- [ ] @mention support in groups
- [ ] Contact information access

### Error Handling
- [ ] Session expiration management
- [ ] Network error resilience
- [ ] Rate limit compliance
- [ ] Offline device handling

## Version Information

- **Plugin Version**: `@elizaos/plugin-whatsapp@2.0.0-alpha.6`
- **Baileys Version**: `@whiskeysockets/baileys@^7.0.0-rc.9`
- **Published**: 2026-02-14

## Related Resources

- [WhatsApp Plugin Repository](https://github.com/elizaos-plugins/plugin-whatsapp)
- [Baileys Documentation](https://github.com/WhiskeySockets/Baileys)
- [Issue #147: WhatsApp Connector Testing](https://github.com/milady-ai/milaidy/issues/147)
- [PR #2: Build Dependencies](https://github.com/elizaos-plugins/plugin-whatsapp/pull/2)
- [PR #3: Baileys Authentication](https://github.com/elizaos-plugins/plugin-whatsapp/pull/3)

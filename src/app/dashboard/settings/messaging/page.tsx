import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Copy, Check, MessageSquare } from 'lucide-react'

const STORAGE_KEY = 'messaging_telegram_bot_token'
const CHAT_ID_KEY = 'messaging_telegram_chat_id'

export default function MessagingSettingsPage() {
  const [botToken, setBotToken] = useState('')
  const [chatId, setChatId] = useState('')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [isTesting, setIsTesting] = useState(false)
  const [testMessage, setTestMessage] = useState('')

  useEffect(() => {
    setWebhookUrl(`${window.location.origin}/api/messaging/webhook?platform=telegram`)
    const savedToken = localStorage.getItem(STORAGE_KEY)
    const savedChatId = localStorage.getItem(CHAT_ID_KEY)
    if (savedToken) setBotToken(savedToken)
    if (savedChatId) setChatId(savedChatId)
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    setSaveMessage('')
    try {
      localStorage.setItem(STORAGE_KEY, botToken)
      localStorage.setItem(CHAT_ID_KEY, chatId)

      // Register webhook with Telegram
      const res = await fetch('/api/messaging/telegram/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken,
          webhookUrl,
          secretToken: undefined,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setSaveMessage('Token saved and webhook registered with Telegram.')
      } else {
        const errorMsg = data.error || 'Unknown error'
        // Provide helpful guidance for common HTTPS requirement issue
        const isHttpsError = errorMsg.includes('HTTPS') || errorMsg.includes('https')
        const message = isHttpsError
          ? `Token saved. Webhook requires HTTPS URL. Use a tunnel (ngrok/Cloudflare) or deploy to production.`
          : `Token saved, but webhook setup failed: ${errorMsg}`
        setSaveMessage(message)
      }
      setTimeout(() => setSaveMessage(''), 8000)
    } catch {
      setSaveMessage('Failed to save. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: user can manually copy
    }
  }

  const handleTest = async () => {
    setIsTesting(true)
    setTestMessage('')
    try {
      const res = await fetch('/api/messaging/telegram/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId }),
      })
      const data = await res.json()
      if (data.success) {
        setTestMessage('✅ Test message sent! Check your Telegram.')
      } else {
        setTestMessage(`❌ Failed: ${data.error ?? 'Unknown error'}`)
      }
      setTimeout(() => setTestMessage(''), 5000)
    } catch {
      setTestMessage('❌ Failed to send test message.')
      setTimeout(() => setTestMessage(''), 5000)
    } finally {
      setIsTesting(false)
    }
  }

  const isConfigured = botToken.trim().length > 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Messaging</h1>
        <p className="mt-2 text-muted-foreground">
          Connect messaging platforms so clients can reach your AI assistant directly.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              <CardTitle>Telegram Bot</CardTitle>
            </div>
            <Badge variant={isConfigured ? 'default' : 'secondary'}>
              {isConfigured ? 'Configured' : 'Not configured'}
            </Badge>
          </div>
          <CardDescription>
            Allow clients to message your scheduling assistant via Telegram.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="botToken">Bot Token</Label>
            <Input
              id="botToken"
              type="password"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder="110201543:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Get your token from{' '}
              <span className="font-medium">@BotFather</span> on Telegram.
              Run <span className="font-mono">/newbot</span> to create a bot.
            </p>
          </div>

          <div className="space-y-2">
            <Button onClick={handleSave} disabled={isSaving} className="w-full">
              {isSaving ? 'Saving...' : 'Save Token'}
            </Button>
            {saveMessage && (
              <p className={`text-sm text-center ${saveMessage.includes('Failed') ? 'text-destructive' : 'text-success-muted-foreground'}`}>
                {saveMessage}
              </p>
            )}
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Test Connection</Label>
            <p className="text-xs text-muted-foreground">
              Send a test message to verify the bot is reachable. Requires the token to be saved and the webhook configured.
            </p>
            <div className="flex gap-2">
              <Input
                id="chatId"
                type="text"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                placeholder="Your Telegram chat ID (e.g., 123456789)"
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={handleTest}
                disabled={isTesting || !chatId.trim()}
                className="flex-shrink-0"
              >
                {isTesting ? 'Sending...' : 'Send Test'}
              </Button>
            </div>
            {testMessage && (
              <p className={`text-sm text-center ${testMessage.includes('✅') ? 'text-success-muted-foreground' : 'text-destructive'}`}>
                {testMessage}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Webhook URL</Label>
            <p className="text-xs text-muted-foreground">
              Paste this URL into BotFather using{' '}
              <span className="font-mono">/setwebhook</span>, or use the Telegram API to set it programmatically.
            </p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={webhookUrl}
                className="bg-secondary text-xs font-mono"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                aria-label="Copy webhook URL"
                className="flex-shrink-0"
              >
                {copied ? <Check className="h-4 w-4 text-success-muted-foreground" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

        </CardContent>
      </Card>
    </div>
  )
}

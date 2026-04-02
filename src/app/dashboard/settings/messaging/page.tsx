import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Copy, Check, MessageSquare } from 'lucide-react'

const STORAGE_KEY = 'messaging_telegram_bot_token'

export default function MessagingSettingsPage() {
  const [botToken, setBotToken] = useState('')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  useEffect(() => {
    setWebhookUrl(`${window.location.origin}/api/messaging/webhook?platform=telegram`)
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) setBotToken(saved)
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    setSaveMessage('')
    try {
      localStorage.setItem(STORAGE_KEY, botToken)

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
        setSaveMessage(`Token saved locally, but webhook setup failed: ${data.error ?? 'Unknown error'}`)
      }
      setTimeout(() => setSaveMessage(''), 5000)
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

          <Separator />

          <div className="space-y-2">
            <Label>Test Connection</Label>
            <p className="text-xs text-muted-foreground">
              Send a test message to verify the bot is reachable. Requires the token to be saved and the webhook configured.
            </p>
            <Button variant="outline" disabled className="w-full">
              Test Connection (coming soon)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

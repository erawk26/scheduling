import { useState, useEffect } from 'react'
import { app } from '@/lib/offlinekit'
import type { BusinessProfile } from '@/lib/offlinekit/schema'
import { getUserTier, FREE_TIER, PAID_TIER } from '@/lib/agent/tier'
import { getMonthlyUsage } from '@/lib/agent/usage-tracker'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { CreditCard, Zap } from 'lucide-react'

type WithMeta<T> = T & { _id: string; _deleted: boolean }

export default function BillingPage() {
  const [tier, setTier] = useState(FREE_TIER)
  const [tokensUsed, setTokensUsed] = useState(0)
  const [emailsSent, setEmailsSent] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const profiles = await app.businessProfile.findMany() as WithMeta<BusinessProfile>[]
        const profile = profiles.find((p) => !p._deleted) ?? null
        const resolvedTier = getUserTier(profile)
        setTier(resolvedTier)

        const userId = (profile as WithMeta<BusinessProfile> | null)?._id ?? '00000000-0000-0000-0000-000000000000'
        const usage = await getMonthlyUsage(userId)
        setTokensUsed(usage.tokensUsed)
        setEmailsSent(usage.emailsSent)
      } catch (err) {
        console.error('Failed to load billing data:', err)
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [])

  const tokenPercent = Math.min(100, Math.round((tokensUsed / tier.maxTokensPerMonth) * 100))
  const emailLimit = tier.maxEmailsPerWeek === -1 ? null : tier.maxEmailsPerWeek
  const emailPercent = emailLimit ? Math.min(100, Math.round((emailsSent / emailLimit) * 100)) : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Billing & Usage</h1>
        <p className="mt-2 text-gray-600">Your current plan and AI usage this month</p>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading billing data...</div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Current Plan
              </CardTitle>
              <CardDescription>Your active subscription tier</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Plan</span>
                <Badge variant={tier.name === 'paid' ? 'default' : 'secondary'}>
                  {tier.name === 'paid' ? 'Pro' : 'Free'}
                </Badge>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">AI Model</span>
                <span className="text-sm font-mono text-gray-800">{tier.model}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Monthly token limit</span>
                <span className="text-sm font-medium text-gray-900">
                  {tier.maxTokensPerMonth.toLocaleString()}
                </span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Weekly email limit</span>
                <span className="text-sm font-medium text-gray-900">
                  {tier.maxEmailsPerWeek === -1 ? 'Unlimited' : tier.maxEmailsPerWeek}
                </span>
              </div>

              {tier.name === 'free' && (
                <>
                  <Separator />
                  <Button className="w-full" disabled>
                    <Zap className="w-4 h-4 mr-2" />
                    Upgrade to Pro
                  </Button>
                  <p className="text-xs text-center text-gray-500">
                    Payment integration coming soon
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Usage This Month</CardTitle>
              <CardDescription>
                Token consumption resets on the 1st of each month
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tokens used</span>
                  <span className="font-medium text-gray-900">
                    {tokensUsed.toLocaleString()} / {tier.maxTokensPerMonth.toLocaleString()}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${tokenPercent >= 95 ? 'bg-red-500' : tokenPercent >= 80 ? 'bg-amber-500' : 'bg-primary'}`}
                    style={{ width: `${tokenPercent}%` }}
                  />
                </div>
                {tokenPercent >= 80 && (
                  <p className="text-xs text-amber-600">
                    {tokenPercent >= 95
                      ? 'Budget nearly exhausted. Upgrade to continue using the AI.'
                      : `${tokenPercent}% used — running low this month.`}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Emails sent this week</span>
                  <span className="font-medium text-gray-900">
                    {emailLimit === null
                      ? `${emailsSent} (unlimited)`
                      : `${emailsSent} / ${emailLimit}`}
                  </span>
                </div>
                {emailLimit !== null && (
                  <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${emailPercent}%` }}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-gray-100 bg-gray-50">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-700">Plan Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div />
                <div className="text-center font-medium text-gray-700">Free</div>
                <div className="text-center font-medium text-gray-700">Pro</div>

                <div className="text-gray-600">Monthly tokens</div>
                <div className="text-center">{FREE_TIER.maxTokensPerMonth.toLocaleString()}</div>
                <div className="text-center">{PAID_TIER.maxTokensPerMonth.toLocaleString()}</div>

                <div className="text-gray-600">Emails / week</div>
                <div className="text-center">{FREE_TIER.maxEmailsPerWeek}</div>
                <div className="text-center">Unlimited</div>

                <div className="text-gray-600">AI model</div>
                <div className="text-center text-xs">Gemma 2 9B</div>
                <div className="text-center text-xs">Claude 3.5</div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

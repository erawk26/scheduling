'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail } from 'lucide-react'

export default function VerifyEmailPage() {
  return (
    <Card>
      <CardHeader className="space-y-1 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Mail className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-2xl font-bold">Check your email</CardTitle>
        <CardDescription>
          We sent a verification link to your email address.
          Please check your inbox and click the link to verify your account.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center text-sm text-gray-500">
        <p>Didn&apos;t receive the email? Check your spam folder or try signing up again.</p>
      </CardContent>
      <CardFooter className="flex justify-center">
        <Button variant="outline" asChild>
          <Link href="/sign-in">Back to Sign In</Link>
        </Button>
      </CardFooter>
    </Card>
  )
}

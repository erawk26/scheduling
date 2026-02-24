'use client';

import { WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 pb-8 text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
            <WifiOff className="w-8 h-8 text-amber-600" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-gray-900">You're Offline</h1>
            <p className="text-gray-500 text-sm leading-relaxed">
              No internet connection detected. Your data is safely stored on this
              device and will sync automatically when you're back online.
            </p>
          </div>

          <div className="space-y-3 text-left bg-gray-50 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-700">While offline you can:</p>
            <ul className="text-sm text-gray-600 space-y-1.5">
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">&#10003;</span>
                View and edit your appointments
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">&#10003;</span>
                Manage clients and services
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">&#10003;</span>
                Create new records
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">&#9679;</span>
                Weather and route data unavailable
              </li>
            </ul>
          </div>

          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            className="w-full"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

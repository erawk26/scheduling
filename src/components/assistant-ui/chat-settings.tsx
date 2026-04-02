import { useState } from 'react'
import { Settings, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

interface ChatSettingsProps {
  onResetLearning: () => Promise<void>
  onOpenSettings?: () => void
}

export function ChatSettings({ onResetLearning, onOpenSettings }: ChatSettingsProps) {
  const [isResetting, setIsResetting] = useState(false)
  const [resetDone, setResetDone] = useState(false)

  const handleReset = async () => {
    setIsResetting(true)
    try {
      await onResetLearning()
      setResetDone(true)
      setTimeout(() => setResetDone(false), 3000)
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <div data-testid="chat-settings" className="flex items-center gap-1">
      {onOpenSettings && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenSettings}
          className="h-8 w-8"
          data-testid="settings-shortcut"
        >
          <Settings className="w-4 h-4 text-muted-foreground" />
        </Button>
      )}

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            data-testid="reset-learning-trigger"
          >
            <Trash2 className="w-4 h-4 text-muted-foreground" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset learned data?</AlertDialogTitle>
            <AlertDialogDescription>
              This will clear all learned preferences, corrections, and patterns.
              The assistant will start fresh with default context only (L0).
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReset}
              disabled={isResetting}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="confirm-reset"
            >
              {isResetting ? 'Resetting...' : 'Reset'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {resetDone && (
        <span data-testid="reset-success" className="text-xs text-success-muted-foreground">
          Reset complete
        </span>
      )}
    </div>
  )
}

import { Plus, MessageSquare, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { ChatThread } from '@/lib/chat-threads';
import { formatDistanceToNow } from 'date-fns';

type ThreadSidebarProps = {
  threads: ChatThread[];
  activeThreadId: string | null;
  onSelectThread: (id: string) => void;
  onNewThread: () => void;
  onDeleteThread: (id: string) => void;
};

export function ThreadSidebar({
  threads,
  activeThreadId,
  onSelectThread,
  onNewThread,
  onDeleteThread,
}: ThreadSidebarProps) {
  return (
    <div className="flex flex-col h-full bg-secondary border-r border-border">
      <div className="p-3">
        <Button
          onClick={onNewThread}
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2"
        >
          <Plus className="w-4 h-4" />
          New chat
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
        {threads.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">No conversations yet</p>
        )}

        {threads.map((thread) => (
          <div
            key={thread.id}
            className={cn(
              'group flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer text-sm transition-colors',
              thread.id === activeThreadId
                ? 'bg-card shadow-sm border border-border text-foreground'
                : 'text-muted-foreground hover:bg-secondary'
            )}
            onClick={() => onSelectThread(thread.id)}
          >
            <MessageSquare className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium">{thread.title}</p>
              <p className="text-xs text-muted-foreground truncate">
                {formatDistanceToNow(new Date(thread.updatedAt), { addSuffix: true })}
              </p>
            </div>
            <button
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-secondary transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteThread(thread.id);
              }}
            >
              <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

import React from 'react';
import { cn } from '@/lib/utils';

interface MobileListItemProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  actions?: React.ReactNode;
}

export function MobileListItem({ children, onClick, className, actions }: MobileListItemProps) {
  return (
    <div
      className={cn(
        "p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-1">
          {children}
        </div>
        {actions && (
          <div className="flex-shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

interface MobileListProps {
  children: React.ReactNode;
  className?: string;
}

export function MobileList({ children, className }: MobileListProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {children}
    </div>
  );
}

interface MobileListTitleProps {
  children: React.ReactNode;
  className?: string;
}

export function MobileListTitle({ children, className }: MobileListTitleProps) {
  return (
    <span className={cn("font-medium text-sm truncate block", className)}>
      {children}
    </span>
  );
}

interface MobileListDetailsProps {
  children: React.ReactNode;
  className?: string;
}

export function MobileListDetails({ children, className }: MobileListDetailsProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground", className)}>
      {children}
    </div>
  );
}

interface MobileListBadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'destructive' | 'outline';
  className?: string;
}

export function MobileListBadge({ children, variant = 'default', className }: MobileListBadgeProps) {
  const variants = {
    default: 'bg-secondary text-secondary-foreground',
    success: 'bg-green-500/10 text-green-600 border-green-500/20',
    warning: 'bg-warning/10 text-warning border-warning/20',
    destructive: 'bg-destructive/10 text-destructive border-destructive/20',
    outline: 'border bg-transparent',
  };

  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border",
      variants[variant],
      className
    )}>
      {children}
    </span>
  );
}

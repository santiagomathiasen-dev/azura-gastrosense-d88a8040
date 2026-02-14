import { Button } from '@/components/ui/button';
import { Plus, LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  const ActionIcon = action?.icon || Plus;
  
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">{title}</h1>
        {description && (
          <p className="text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {action && (
        <Button onClick={action.onClick} className="w-full sm:w-auto">
          <ActionIcon className="h-4 w-4 mr-2" />
          {action.label}
        </Button>
      )}
    </div>
  );
}

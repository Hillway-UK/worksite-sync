import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface CapacityLimitDialogProps {
  open: boolean;
  onClose: () => void;
  type: 'manager' | 'worker';
  planned: number;
  active: number;
}

export const CapacityLimitDialog = ({
  open,
  onClose,
  type,
  planned,
  active
}: CapacityLimitDialogProps) => {
  const entityName = type === 'manager' ? 'Manager' : 'Worker';
  const entityNamePlural = type === 'manager' ? 'Managers' : 'Workers';
  
  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {entityName} Limit Reached
          </AlertDialogTitle>
          <AlertDialogDescription>
            You've reached your planned limit for {entityNamePlural.toLowerCase()}.
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <div className="flex justify-between mb-2">
                <span className="font-medium">Planned {entityNamePlural}:</span>
                <span>{planned}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Active {entityNamePlural}:</span>
                <span>{active}</span>
              </div>
            </div>
            <p className="mt-4">
              To add more {entityNamePlural.toLowerCase()}, please contact support to upgrade your subscription plan.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={onClose}>
            Understood
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

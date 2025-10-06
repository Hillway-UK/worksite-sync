import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";

interface CapacityLimitDialogProps {
  open: boolean;
  onClose: () => void;
  type: 'manager' | 'worker';
  planName: string;
  currentCount: number;
  maxAllowed: number | null;
  plannedCount: number;
}

export const CapacityLimitDialog = ({
  open,
  onClose,
  type,
  planName,
  currentCount,
  maxAllowed,
  plannedCount
}: CapacityLimitDialogProps) => {
  const entityName = type === 'manager' ? 'Manager' : 'Worker';
  const entityNamePlural = type === 'manager' ? 'Managers' : 'Workers';
  
  const isUnlimited = maxAllowed === null || maxAllowed === 999999;
  
  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {entityName} Limit Reached
          </AlertDialogTitle>
          <AlertDialogDescription>
            <div className="space-y-4">
              <p>
                You've reached the maximum number of {entityNamePlural.toLowerCase()} for your organization's {planName} plan.
              </p>
              
              <div className="bg-muted rounded-lg p-4 space-y-3">
                <div className="font-semibold text-foreground text-sm">
                  Current {planName} Plan Capacity:
                </div>
                
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-muted-foreground">Current {entityNamePlural}</div>
                    <div className="text-lg font-bold text-foreground">{currentCount}</div>
                  </div>
                  
                  <div>
                    <div className="text-muted-foreground">Planned {entityNamePlural}</div>
                    <div className="text-lg font-bold text-foreground">
                      {isUnlimited ? 'Unlimited' : plannedCount}
                    </div>
                  </div>
                  
                  {!isUnlimited && (
                    <div className="col-span-2">
                      <div className="text-muted-foreground">Plan Maximum</div>
                      <div className="text-lg font-bold text-foreground">{maxAllowed}</div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  <strong>To add more {entityNamePlural.toLowerCase()}:</strong>
                  <br />
                  {isUnlimited 
                    ? 'Contact your administrator to increase your planned capacity.'
                    : 'Upgrade your subscription plan or contact support to increase your limits.'
                  }
                </p>
              </div>
            </div>
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

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Users, Briefcase } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PlanOption {
  type: string;
  name: string;
  managers: number;
  workers: number;
  monthlyPrice: number;
  description: string;
}

const PLANS: PlanOption[] = [
  {
    type: 'starter',
    name: 'Starter',
    managers: 2,
    workers: 10,
    monthlyPrice: 65,
    description: 'Perfect for small teams'
  },
  {
    type: 'pro',
    name: 'Pro',
    managers: 5,
    workers: 100,
    monthlyPrice: 275,
    description: 'For growing businesses'
  },
  {
    type: 'enterprise',
    name: 'Enterprise',
    managers: 999999,
    workers: 999999,
    monthlyPrice: 0,
    description: 'Custom pricing for large teams'
  }
];

interface UpgradeSubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  currentPlan: string;
  currentManagers: number;
  currentWorkers: number;
  onUpgradeComplete: () => void;
}

export const UpgradeSubscriptionDialog = ({
  open,
  onOpenChange,
  organizationId,
  currentPlan,
  currentManagers,
  currentWorkers,
  onUpgradeComplete
}: UpgradeSubscriptionDialogProps) => {
  const [upgrading, setUpgrading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanOption | null>(null);

  const handleUpgrade = async () => {
    if (!selectedPlan) return;

    setUpgrading(true);
    try {
      const { data, error } = await supabase.functions.invoke('upgrade-subscription-plan', {
        body: {
          organizationId,
          newMaxManagers: selectedPlan.managers,
          newMaxWorkers: selectedPlan.workers,
          planType: selectedPlan.type
        }
      });

      if (error) throw error;

      toast.success(`Successfully upgraded to ${selectedPlan.name} plan!`);
      onUpgradeComplete();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Upgrade error:', error);
      toast.error(error.message || 'Failed to upgrade subscription');
    } finally {
      setUpgrading(false);
    }
  };

  const availablePlans = PLANS.filter(plan => {
    // Filter out current plan and lower tier plans
    const planOrder = ['trial', 'starter', 'pro', 'enterprise'];
    const currentIndex = planOrder.indexOf(currentPlan.toLowerCase());
    const planIndex = planOrder.indexOf(plan.type);
    return planIndex > currentIndex;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Upgrade Your Subscription
          </DialogTitle>
          <DialogDescription>
            Choose a plan that fits your team's needs. Your current active users ({currentManagers} managers, {currentWorkers} workers) will be carried over.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted/50 p-4 rounded-lg">
            <div className="text-sm font-medium mb-2">Current Plan</div>
            <Badge className="text-sm">{currentPlan.toUpperCase()}</Badge>
            <div className="text-sm text-muted-foreground mt-2">
              {currentManagers} active managers / {currentWorkers} active workers
            </div>
          </div>

          <div className="grid gap-4">
            {availablePlans.map((plan) => (
              <div
                key={plan.type}
                className={`border rounded-lg p-4 cursor-pointer transition-all ${
                  selectedPlan?.type === plan.type
                    ? 'border-primary bg-primary/5'
                    : 'hover:border-primary/50'
                }`}
                onClick={() => setSelectedPlan(plan)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg">{plan.name}</h3>
                      {plan.type === 'pro' && (
                        <Badge variant="default" className="text-xs">Popular</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{plan.description}</p>
                    
                    <div className="flex gap-6 text-sm">
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                        <span>{plan.managers === 999999 ? 'Unlimited' : plan.managers} managers</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{plan.workers === 999999 ? 'Unlimited' : plan.workers} workers</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    {plan.monthlyPrice > 0 ? (
                      <>
                        <div className="text-2xl font-bold">£{plan.monthlyPrice}</div>
                        <div className="text-sm text-muted-foreground">per month</div>
                      </>
                    ) : (
                      <div className="text-lg font-semibold">Contact us</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {availablePlans.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              You're already on the highest plan!
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={upgrading}>
            Cancel
          </Button>
          <Button 
            onClick={handleUpgrade} 
            disabled={!selectedPlan || upgrading}
            className="bg-primary hover:bg-primary/90"
          >
            {upgrading ? 'Upgrading...' : `Upgrade to ${selectedPlan?.name || 'Selected Plan'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

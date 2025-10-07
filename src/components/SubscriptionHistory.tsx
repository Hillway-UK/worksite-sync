import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Calendar, TrendingUp } from "lucide-react";

interface SubscriptionHistoryProps {
  organizationId: string;
}

export const SubscriptionHistory = ({ organizationId }: SubscriptionHistoryProps) => {
  const { data: history, isLoading } = useQuery({
    queryKey: ['subscription-history', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_usage')
        .select('*')
        .eq('organization_id', organizationId)
        .order('effective_start_date', { ascending: false });

      if (error) throw error;
      return data;
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Active</Badge>;
      case 'expired':
        return <Badge variant="outline" className="text-muted-foreground">Expired</Badge>;
      case 'upcoming':
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">Upcoming</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPlanBadge = (planType: string) => {
    const colors: Record<string, string> = {
      trial: "bg-amber-500/10 text-amber-600 border-amber-500/20",
      starter: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      pro: "bg-purple-500/10 text-purple-600 border-purple-500/20",
      enterprise: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
    };

    return (
      <Badge className={colors[planType] || "bg-gray-500/10 text-gray-600 border-gray-500/20"}>
        {planType?.toUpperCase() || 'CUSTOM'}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Loading subscription history...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Subscription History
        </CardTitle>
        <CardDescription>
          View all subscription changes for your organization
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {history?.map((sub, index) => (
            <div
              key={sub.id}
              className="flex items-start justify-between p-4 rounded-lg border bg-card"
            >
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-3">
                  {getPlanBadge(sub.plan_type)}
                  {getStatusBadge(sub.status)}
                  {index === 0 && sub.status === 'active' && (
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Period:</span>
                    <div className="font-medium">
                      {format(new Date(sub.effective_start_date), 'MMM dd, yyyy')}
                      {sub.effective_end_date && (
                        <> - {format(new Date(sub.effective_end_date), 'MMM dd, yyyy')}</>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <span className="text-muted-foreground">Limits:</span>
                    <div className="font-medium">
                      {sub.planned_number_of_managers} managers / {sub.planned_number_of_workers} workers
                    </div>
                  </div>
                  
                  <div>
                    <span className="text-muted-foreground">Active Count:</span>
                    <div className="font-medium">
                      {sub.active_managers} managers / {sub.active_workers} workers
                    </div>
                  </div>

                  {sub.total_cost && (
                    <div>
                      <span className="text-muted-foreground">Cost:</span>
                      <div className="font-medium">£{sub.total_cost}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {(!history || history.length === 0) && (
            <div className="text-center text-muted-foreground py-8">
              No subscription history available
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

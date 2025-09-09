import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface TeamMember {
  name: string;
  email: string;
  role: 'manager' | 'worker';
  hourlyRate?: number;
}

interface TeamSetupStepProps {
  organizationId?: string;
}

export const TeamSetupStep: React.FC<TeamSetupStepProps> = ({ organizationId }) => {
  const navigate = useNavigate();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([
    { name: '', email: '', role: 'manager' }
  ]);
  const [loading, setLoading] = useState(false);

  const addTeamMember = () => {
    setTeamMembers([...teamMembers, { name: '', email: '', role: 'worker' }]);
  };

  const removeTeamMember = (index: number) => {
    if (teamMembers.length > 1) {
      setTeamMembers(teamMembers.filter((_, i) => i !== index));
    }
  };

  const updateTeamMember = (index: number, field: keyof TeamMember, value: string | number) => {
    const updated = [...teamMembers];
    updated[index] = { ...updated[index], [field]: value };
    setTeamMembers(updated);
  };

  const handleCreateTeam = async () => {
    setLoading(true);
    try {
      // Get organization ID if not provided as prop
      let orgId = organizationId;
      
      if (!orgId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.email) {
          throw new Error('Not authenticated');
        }

        const { data: managerData } = await supabase
          .from('managers')
          .select('organization_id')
          .eq('email', user.email)
          .single();
        
        if (!managerData?.organization_id) {
          throw new Error('No organization found for current user');
        }
        
        orgId = managerData.organization_id;
      }

      // Filter out empty entries
      const validMembers = teamMembers.filter(member => 
        member.name.trim() && member.email.trim()
      );

      if (validMembers.length === 0) {
        toast.error('Please add at least one team member');
        return;
      }

      // Create team members in the database
      for (const member of validMembers) {
        const table = member.role === 'manager' ? 'managers' : 'workers';
        const insertData = member.role === 'manager' 
          ? { 
              name: member.name, 
              email: member.email,
              organization_id: orgId 
            }
          : { 
              name: member.name, 
              email: member.email, 
              hourly_rate: member.hourlyRate || 25.00,
              organization_id: orgId
            };

        const { error } = await supabase
          .from(table)
          .insert(insertData);

        if (error) throw error;
      }

      toast.success('Team setup complete!');
      navigate('/organization');
    } catch (error: any) {
      console.error('Team setup error:', error);
      toast.error(error.message || 'Failed to create team');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    toast.success('You can add team members later in the admin panel');
    navigate('/organization');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-6 w-6 text-black" />
          Add Your Team
        </CardTitle>
        <CardDescription>
          Add managers and workers to get started (you can always add more later)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {teamMembers.map((member, index) => (
          <div key={index} className="border rounded-lg p-4 space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="font-medium">Team Member {index + 1}</h4>
              {teamMembers.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeTeamMember(index)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Name</Label>
                <Input
                  value={member.name}
                  onChange={(e) => updateTeamMember(index, 'name', e.target.value)}
                  placeholder="Full name"
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={member.email}
                  onChange={(e) => updateTeamMember(index, 'email', e.target.value)}
                  placeholder="email@company.com"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Role</Label>
                <select
                  value={member.role}
                  onChange={(e) => updateTeamMember(index, 'role', e.target.value)}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="manager">Manager</option>
                  <option value="worker">Worker</option>
                </select>
              </div>
              {member.role === 'worker' && (
                <div>
                  <Label>Hourly Rate (£)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.50"
                    value={member.hourlyRate || ''}
                    onChange={(e) => updateTeamMember(index, 'hourlyRate', parseFloat(e.target.value))}
                    placeholder="25.00"
                  />
                </div>
              )}
            </div>
          </div>
        ))}

        <Button
          variant="outline"
          onClick={addTeamMember}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Another Team Member
        </Button>

        <div className="flex gap-4">
          <Button
            variant="outline"
            onClick={handleSkip}
            className="flex-1"
          >
            Skip for Now
          </Button>
          <Button
            onClick={handleCreateTeam}
            disabled={loading}
            className="flex-1 bg-black hover:bg-gray-800"
          >
            {loading ? 'Creating Team...' : 'Create Team & Finish'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
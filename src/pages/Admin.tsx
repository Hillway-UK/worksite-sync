import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Briefcase } from 'lucide-react';

export default function Admin() {
  const { user } = useAuth();
  const [managerName, setManagerName] = useState('');

  useEffect(() => {
    const fetchManagerName = async () => {
      if (user?.email) {
        try {
          const { data: manager } = await supabase
            .from('managers')
            .select('name')
            .eq('email', user.email)
            .single();

          if (manager) {
            setManagerName(manager.name);
          }
        } catch (error) {
          console.error('Error fetching manager name:', error);
        }
      }
    };

    fetchManagerName();
  }, [user?.email]);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <Briefcase className="h-16 w-16 text-primary mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Welcome, {managerName || 'Manager'}
          </h1>
          <p className="text-muted-foreground">
            Manager dashboard for workforce management
          </p>
        </div>
      </div>
    </Layout>
  );
}
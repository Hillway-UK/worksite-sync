import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AdminProfile() {
  const [name, setName] = useState('');
  const [managerId, setManagerId] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadManager();
  }, []);

  const loadManager = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const { data } = await supabase
      .from('managers')
      .select('*')
      .eq('email', user.email)
      .single();
    
    if (data) {
      setName(data.name || '');
      setManagerId(data.id);
    }
  };

  const save = async () => {
    const { error } = await supabase
      .from('managers')
      .update({ name: name })
      .eq('id', managerId);
    
    if (error) {
      toast.error('Failed to save');
    } else {
      toast.success('Saved!');
    }
  };

  return (
    <Layout>
      <div className="p-8">
        <div className="mb-6">
          <Button 
            variant="outline" 
            onClick={() => navigate('/admin')}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Admin
          </Button>
          <h1 className="text-2xl font-bold">Manager Profile</h1>
        </div>
        
        <div className="max-w-md">
          <label className="block mb-2">Name:</label>
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mb-4"
          />
          
          <Button onClick={save}>Save Name</Button>
        </div>
      </div>
    </Layout>
  );
}
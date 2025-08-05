import React from 'react';
import { Layout } from '@/components/Layout';
import { FileText } from 'lucide-react';

export default function AdminReports() {
  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <FileText className="h-16 w-16 text-primary mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Weekly Reports
          </h1>
          <p className="text-muted-foreground">
            View and generate workforce time reports
          </p>
        </div>
      </div>
    </Layout>
  );
}
import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Search, Key, PlayCircle, UserPlus, Edit3, UserX, Briefcase, FileSearch, DollarSign, Clock, FileText } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface Tutorial {
  id: string;
  title: string;
  icon: LucideIcon;
  embedUrl: string;
  category: 'Getting Started' | 'Workers' | 'Jobs' | 'Expense & Time' | 'Reports';
}

const tutorials: Tutorial[] = [
  {
    id: 'login',
    title: 'How to Log In to TimeTrack Manager Console',
    icon: Key,
    embedUrl: 'https://scribehow.com/embed/How_to_Log_In_to_TimeTrack_Manager_Console___qnSy3oySNqQ0nA0pY3Elw?as=video',
    category: 'Getting Started'
  },
  {
    id: 'change-password',
    title: 'How to Change Your TimeTrack Password',
    icon: Key,
    embedUrl: 'https://scribehow.com/embed/How_to_Change_Your_TimeTrack_Password__sBgdCeuETSmHy8UDNh3Khw?as=video',
    category: 'Getting Started'
  },
  {
    id: 'dashboard-tutorial',
    title: 'How to Run the TimeTrack Dashboard Tutorial',
    icon: PlayCircle,
    embedUrl: 'https://scribehow.com/embed/How_to_Run_the_TimeTrack_Dashboard_Tutorial__yp30lAiuTNSfi_FZtYwI0Q?as=video',
    category: 'Getting Started'
  },
  {
    id: 'add-worker',
    title: 'How to Add a New Worker to TimeTrack',
    icon: UserPlus,
    embedUrl: 'https://scribehow.com/embed/How_to_Add_a_New_Worker_to_the_TimeTrack__xUloYbEmTbezglQGD56maQ?as=video',
    category: 'Workers'
  },
  {
    id: 'update-worker',
    title: 'How to Update Worker on TimeTrack',
    icon: Edit3,
    embedUrl: 'https://scribehow.com/embed/How_to_Update_Worker_on_TimeTrack__W2tL429sTl2Ab9eQb1r3yQ?as=video',
    category: 'Workers'
  },
  {
    id: 'manage-worker',
    title: 'How to Activate, Deactivate, or Delete a Worker',
    icon: UserX,
    embedUrl: 'https://scribehow.com/embed/How_to_Activate_Deactivate_or_Delete_a_Worker_in_TimeTrack__d3Rp6KONQlSWLLJBl5-KHA?as=video',
    category: 'Workers'
  },
  {
    id: 'add-job',
    title: 'How to Add a New Job in TimeTrack',
    icon: Briefcase,
    embedUrl: 'https://scribehow.com/embed/How_to_Add_a_New_Job_in_Autotime__ubmvaEkDT5eKfgPi-uwWeg?as=video',
    category: 'Jobs'
  },
  {
    id: 'search-update-job',
    title: 'How to Search and Update a Job in TimeTrack',
    icon: FileSearch,
    embedUrl: 'https://scribehow.com/embed/How_to_Search_and_Update_a_Job_in_TimeTrack__UWBbNq_mSNuTUEFBA6Ipow?as=video',
    category: 'Jobs'
  },
  {
    id: 'manage-job',
    title: 'How to Deactivate, Reactivate, or Delete a Job',
    icon: Briefcase,
    embedUrl: 'https://scribehow.com/embed/How_to_Deactivate_Reactivate_or_Delete_a_Job_in_Autotime__74x0CKFrQ1a-GSh4pY_lHw?as=video',
    category: 'Jobs'
  },
  {
    id: 'add-expense-types',
    title: 'How to Add Expense Types in TimeTrack',
    icon: DollarSign,
    embedUrl: 'https://scribehow.com/embed/How_to_Add_Expense_Types_in_Autotime__2cGo_byQQhaWKo3n1TZ6jw?as=video',
    category: 'Expense & Time'
  },
  {
    id: 'approve-amendments',
    title: 'How to Approve or Reject Pending Time Amendments',
    icon: Clock,
    embedUrl: 'https://scribehow.com/embed/How_to_Approve_or_Reject_Pending_Time_Amendments__CEiBwtM3ShqmZHMSDY0KMQ?as=video',
    category: 'Expense & Time'
  },
  {
    id: 'generate-export-report',
    title: 'How to Generate Report and Export Weekly Timesheet to Xero',
    icon: FileText,
    embedUrl: 'https://scribehow.com/embed/How_to_Generate_Report_and_Export_Weekly_Timesheet_to_Xero__oZAG5YauTjOwSvi1NgpEWA?as=video',
    category: 'Reports'
  }
];

const Resources = () => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTutorials = tutorials.filter(tutorial =>
    tutorial.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tutorial.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Header Section */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-2 flex items-center justify-center gap-2">
            TimeTrack Resources & How-To Guides
          </h1>
          <p className="text-muted-foreground text-lg">
            Learn how to master TimeTrack - one quick Scribe at a time.
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-6 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            type="text"
            placeholder="Find a tutorial..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Tutorials Accordion */}
        <Card className="shadow-lg">
          <CardContent className="p-6">
            {filteredTutorials.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No tutorials found matching "{searchQuery}"
              </div>
            ) : (
              <Accordion type="single" collapsible className="w-full">
                {filteredTutorials.map((tutorial) => (
                  <AccordionItem key={tutorial.id} value={tutorial.id}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-3">
                        <tutorial.icon className="h-5 w-5 text-primary" />
                        <span className="text-left font-medium">{tutorial.title}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="pt-4">
                        <iframe
                          src={tutorial.embedUrl}
                          width="100%"
                          height="640"
                          allow="fullscreen"
                          style={{ aspectRatio: '16 / 12', border: 0, minHeight: '480px' }}
                          className="rounded-lg"
                          title={tutorial.title}
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Resources;




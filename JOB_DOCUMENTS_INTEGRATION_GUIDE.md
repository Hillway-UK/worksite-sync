# Job Documents Integration Guide

## Overview
This feature allows managers to upload Terms & Conditions and Waiver/Consent forms for each job site. When workers clock in to a job with documents, they must review and accept them before proceeding.

## Database Setup

### 1. Run SQL Script
Execute the `DATABASE_JOB_DOCUMENTS_SETUP.sql` script in your Supabase SQL Editor to:
- Add `terms_and_conditions_url` and `waiver_url` columns to the `jobs` table
- Create the `job-documents` storage bucket
- Set up Row Level Security (RLS) policies

### 2. Verify Setup
Run this query to confirm the columns were added:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'jobs' 
AND column_name IN ('terms_and_conditions_url', 'waiver_url');
```

## Manager Workflow

### Adding Documents to Jobs

1. **Navigate to Jobs Management**
   - Go to Admin → Jobs

2. **Add/Edit a Job**
   - Click "Add New Job" or edit an existing job
   - Fill in job details (code, name, address)

3. **Upload Documents** (Before Address Fields)
   - **Terms & Conditions**: Upload PDF, DOC, DOCX, or TXT file
   - **Waiver/Consent Form**: Upload PDF, DOC, DOCX, or TXT file
   - Both fields are optional
   - Green checkmark (✓) appears when document is uploaded

4. **Complete Job Setup**
   - Set job location on map
   - Configure geofence radius
   - Save the job

### Managing Documents

- **Update Documents**: Edit the job and upload new files (replaces existing)
- **View Existing**: Green checkmark indicates a document is already uploaded
- **Remove**: Upload a new file or leave blank when updating

## Worker Experience

### Clock-In Process with Job Documents

1. **Worker Selects Job to Clock In**
   - Opens clock-in interface
   - Selects job from available job sites

2. **Document Review Modal Appears** (if job has documents)
   - Modal displays job name and required documents
   - Each document shows:
     - Document type (Terms & Conditions / Waiver Form)
     - "View Document" button to open in new tab
     - Checkbox to accept
     - Green checkmark when accepted

3. **Accept Documents**
   - Worker must check all acceptance boxes
   - "Accept & Continue" button enables when all documents accepted
   - Can decline to cancel clock-in

4. **Clock-In Proceeds**
   - After acceptance, normal clock-in flow continues
   - GPS verification and photo capture

### Important Notes for Workers

- Documents must be accepted each time clocking in to that job
- Declining documents prevents clock-in to that job site
- Acceptance is required to proceed with GPS verification
- Documents open in new browser tab for review

## Technical Implementation

### Components

1. **JobDialog** (`src/components/JobDialog.tsx`)
   - Document upload fields
   - File validation (PDF, DOC, DOCX, TXT)
   - Storage integration
   - State management for uploads

2. **JobDocumentAcceptance** (`src/components/JobDocumentAcceptance.tsx`)
   - Modal dialog for document review
   - Acceptance checkboxes
   - Accept/Decline buttons
   - Document download links

### Storage

- **Bucket**: `job-documents` (public)
- **Accepted Formats**: `.pdf`, `.doc`, `.docx`, `.txt`
- **File Naming**: `{timestamp}_{random}.{ext}`
- **Access**: 
  - Managers: Upload, Update, Delete
  - All authenticated users: Read

### Database Schema

```sql
ALTER TABLE jobs 
ADD COLUMN terms_and_conditions_url TEXT,
ADD COLUMN waiver_url TEXT;
```

## Integration with Clock-In

To integrate with your worker clock-in flow, use the `JobDocumentAcceptance` component:

```tsx
import { JobDocumentAcceptance } from '@/components/JobDocumentAcceptance';

// In your clock-in component
const [showDocuments, setShowDocuments] = useState(false);
const [selectedJob, setSelectedJob] = useState(null);

const handleJobSelect = async (job) => {
  // Check if job has documents
  if (job.terms_and_conditions_url || job.waiver_url) {
    setSelectedJob(job);
    setShowDocuments(true);
  } else {
    // Proceed with clock-in
    handleClockIn(job);
  }
};

const handleDocumentsAccepted = () => {
  setShowDocuments(false);
  // Proceed with clock-in for selected job
  handleClockIn(selectedJob);
};

const handleDocumentsDeclined = () => {
  setShowDocuments(false);
  setSelectedJob(null);
  toast.error('You must accept job documents to clock in');
};

return (
  <>
    {/* Your clock-in UI */}
    
    <JobDocumentAcceptance
      open={showDocuments}
      jobName={selectedJob?.name || ''}
      termsUrl={selectedJob?.terms_and_conditions_url}
      waiverUrl={selectedJob?.waiver_url}
      onAccept={handleDocumentsAccepted}
      onDecline={handleDocumentsDeclined}
    />
  </>
);
```

## Security Considerations

1. **RLS Policies**: Only managers can upload/modify documents
2. **Public Bucket**: Documents are publicly accessible via URL
3. **File Validation**: Only specific document types accepted
4. **No PII**: Documents should not contain worker personal data
5. **Acceptance Tracking**: Consider logging acceptances to database

## Future Enhancements

- Log worker document acceptances with timestamp
- Track acceptance history per worker
- Version control for document updates
- Email notification when documents change
- Digital signature capture
- Offline document caching for workers

## Troubleshooting

### Documents Not Uploading
- Check storage bucket permissions
- Verify RLS policies are active
- Check file size limits (default 50MB)
- Ensure correct file format

### Documents Not Displaying to Workers  
- Verify job has documents uploaded (check URL fields)
- Check storage bucket is public
- Verify public URL generation is correct
- Check browser console for errors

### RLS Policy Issues
- Ensure manager email exists in managers table
- Verify auth.uid() matches user
- Check policy definitions in SQL

## Support

For issues or questions about job documents:
1. Check this guide first
2. Review component props and implementation
3. Verify database setup with verification queries
4. Check Supabase Storage dashboard

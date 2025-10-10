import { Step } from 'react-joyride';

export const addExpenseTypeSteps: Step[] = [
  {
    target: 'body',
    content: '💰 Let\'s create an expense type! This form defines what workers can claim.',
    placement: 'center',
  },
  {
    target: '#name',
    content: '📝 Enter a clear name for this expense type (e.g., "Lunch Allowance").',
    placement: 'bottom',
  },
  {
    target: '#amount',
    content: '💷 Set the standard amount for this expense in pounds.',
    placement: 'bottom',
  },
  {
    target: '#description',
    content: '📄 Add an optional description to help workers understand when to use this expense type.',
    placement: 'bottom',
  },
  {
    target: '#is_active',
    content: '🔄 Toggle this switch to activate or deactivate the expense type.',
    placement: 'top',
  },
  {
    target: '.expense-submit-button',
    content: '✅ Click Create to save your expense type and make it available to workers!',
    placement: 'top',
  },
];

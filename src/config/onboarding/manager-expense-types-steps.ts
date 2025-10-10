import { Step } from 'react-joyride';

export const expenseTypesSteps: Step[] = [
  {
    target: 'body',
    content: '💰 Welcome to Expense Types! Here you can manage the expense categories that workers can claim.',
    placement: 'center',
  },
  {
    target: '.expense-quick-add',
    content: '⚡ Quick Add buttons let you create common expense types instantly.',
    placement: 'bottom',
  },
  {
    target: '.expense-search',
    content: '🔍 Search and filter expense types to find what you need.',
    placement: 'bottom',
  },
  {
    target: '.expense-add-button',
    content: '➕ Click here to create custom expense types with your own amounts and descriptions.',
    placement: 'bottom',
  },
  {
    target: '.expense-table',
    content: '📊 This table shows all your expense types. You can edit, activate/deactivate, or delete them using the actions menu.',
    placement: 'top',
  },
];

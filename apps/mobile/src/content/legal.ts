export type LegalDocType = 'terms' | 'privacy';

export type LegalSection = {
  title: string;
  body: string[];
};

export const LEGAL_LAST_UPDATED = 'February 21, 2026';

export const TERMS_SECTIONS: LegalSection[] = [
  {
    title: '1) Agreement and Scope',
    body: [
      'These Terms govern your use of LEDGR web and mobile apps, APIs, and related services.',
      'By creating an account or using LEDGR, you agree to these Terms.',
    ],
  },
  {
    title: '2) Eligibility and Accounts',
    body: [
      'You must be at least 18 years old and able to enter a binding agreement.',
      'You are responsible for account security, device access, and activity under your login.',
    ],
  },
  {
    title: '3) What LEDGR Provides',
    body: [
      'LEDGR provides personal finance software for account aggregation, transaction review, budgeting, goals, and cash-flow insights.',
      'LEDGR is software only and does not provide banking, brokerage, legal, tax, or investment-advisory services.',
    ],
  },
  {
    title: '4) Connected Accounts and Plaid',
    body: [
      'When you link accounts, you authorize LEDGR and Plaid to access account, balance, and transaction data needed to deliver the product.',
      'Your use of connected-account features is also subject to Plaid terms and your financial institution terms.',
    ],
  },
  {
    title: '5) Transaction Classification and Rules',
    body: [
      'LEDGR auto-classifies transactions and allows manual edits, rules, splits, and internal transfer tagging.',
      'You are responsible for reviewing and confirming classifications before relying on reports.',
    ],
  },
  {
    title: '6) AI Coaching and Recommendations',
    body: [
      'Penny provides informational summaries and planning suggestions based on your data and prompts.',
      'AI output may be incomplete or incorrect and is not professional legal, tax, accounting, lending, or investment advice.',
    ],
  },
  {
    title: '7) Acceptable Use',
    body: [
      'You may not misuse the service, attempt unauthorized access, scrape non-public endpoints, reverse engineer protections, or interfere with operations.',
      'You may not use LEDGR for fraud, money laundering, unlawful surveillance, or other illegal activity.',
    ],
  },
  {
    title: '8) Availability and Changes',
    body: [
      'We may modify features, limits, integrations, and supported institutions over time.',
      'We may suspend access for abuse, security incidents, legal risk, or unpaid obligations.',
    ],
  },
  {
    title: '9) Fees and Subscriptions',
    body: [
      'If paid plans are introduced or enabled, pricing and billing terms will be shown in-product before purchase.',
      'Subscription purchases and cancellations are governed by the platform used to purchase (for example, Apple App Store).',
    ],
  },
  {
    title: '10) Disclaimers',
    body: [
      'LEDGR is provided "as is" and "as available" without warranties of uninterrupted access, accuracy, merchantability, or fitness for a particular purpose.',
      'Institution outages, delayed syncs, and third-party API changes can impact data freshness and completeness.',
    ],
  },
  {
    title: '11) Limitation of Liability',
    body: [
      'To the maximum extent allowed by law, LEDGR is not liable for indirect, incidental, special, consequential, or punitive damages.',
      'Our total liability for claims related to the service is limited to amounts paid by you to LEDGR in the prior 12 months.',
    ],
  },
  {
    title: '12) Contact and Updates',
    body: [
      'We may update these Terms and will update the "Last updated" date when we do.',
      'Questions: brandennevius@gmail.com',
    ],
  },
];

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    title: '1) Data We Collect',
    body: [
      'Account data: email, authentication identifiers, and profile metadata.',
      'Financial data: accounts, balances, transactions, liabilities, and investment fields from Plaid-authorized connections.',
      'Product data: categories, rules, goals, review states, and user settings.',
      'Support data: information you provide when contacting support.',
    ],
  },
  {
    title: '2) Why We Use Data',
    body: [
      'To provide core product features including sync, dashboards, budgets, and goals.',
      'To improve classification quality, reliability, and fraud/abuse detection.',
      'To generate AI responses and coaching insights based on your prompt and selected context.',
    ],
  },
  {
    title: '3) AI Data Handling',
    body: [
      'We use prompt-minimization to prefer aggregated and de-identified context for most coaching requests.',
      'Transaction-level details are only included when required to answer your specific question.',
      'We do not sell AI prompt data.',
    ],
  },
  {
    title: '4) How We Share Data',
    body: [
      'We share data only with processors needed to operate LEDGR, including Supabase (auth/database), Plaid (aggregation), and OpenAI (AI processing).',
      'We may disclose data when legally required or to protect rights, safety, and platform security.',
    ],
  },
  {
    title: '5) Security Controls',
    body: [
      'Data in transit uses TLS.',
      'Access is controlled with authenticated APIs, row-level data checks in application logic, and environment-scoped credentials.',
      'We maintain monitoring and rate limiting for security and abuse prevention.',
    ],
  },
  {
    title: '6) Retention and Deletion',
    body: [
      'We retain data while your account is active and as needed for security, compliance, and operational records.',
      'You can request account deletion; we delete active-account data and retain only records required by law or security obligations.',
    ],
  },
  {
    title: '7) Your Choices',
    body: [
      'Disconnect linked institutions at any time.',
      'Export your transactions from settings.',
      'Request access, correction, or deletion by contacting support.',
    ],
  },
  {
    title: '8) Children and Sensitive Use',
    body: [
      'LEDGR is not intended for children under 13 and we do not knowingly collect data from children under 13.',
      'Do not use LEDGR to store highly sensitive credentials outside supported flows.',
    ],
  },
  {
    title: '9) International Processing',
    body: [
      'Service providers may process data in regions where they operate.',
      'By using LEDGR, you acknowledge cross-border transfer and processing as needed to operate the service.',
    ],
  },
  {
    title: '10) Policy Updates and Contact',
    body: [
      'We may revise this policy and will update the "Last updated" date.',
      'Privacy requests: brandennevius@gmail.com',
    ],
  },
];

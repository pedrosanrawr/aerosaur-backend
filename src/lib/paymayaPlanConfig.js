const PLANS = {
  PREMIUM_QUARTERLY: {
    planId:      'PREMIUM_QUARTERLY',
    name:        'Premium Quarterly',
    description: 'Full access to all premium features for 3 month',
    amount:      149.99,
    currency:    'PHP',
    durationDays: 92,
  },
};

export const getPlan = (planId) => {
  const plan = PLANS[planId];
  if (!plan) throw new Error(`Invalid planId: ${planId}`);
  return plan;
};

export { PLANS };
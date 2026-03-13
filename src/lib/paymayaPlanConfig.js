const PLANS = {
  PREMIUM_MONTHLY: {
    planId:      'PREMIUM_MONTHLY',
    name:        'Premium Monthly',
    description: 'Full access to all premium features for 1 month',
    amount:      9.99,
    currency:    'PHP',
    durationDays: 30,
  },
};

export const getPlan = (planId) => {
  const plan = PLANS[planId];
  if (!plan) throw new Error(`Invalid planId: ${planId}`);
  return plan;
};

export { PLANS };
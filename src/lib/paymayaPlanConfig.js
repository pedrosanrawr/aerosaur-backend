const PLANS = {
  PREMIUM_MONTHLY: {
    planId:      'PREMIUM_MONTHLY',
    name:        'Premium Monthly',
    description: 'Full access to all premium features for 1 month',
    amount:      299,     //pa paltan dito ng monthly
    currency:    'PHP',
    durationDays: 30,
  },
};
const getPlan = (planId) => {
  const plan = PLANS[planId];
  if (!plan) throw new Error(`Invalid planId: ${planId}`);
  return plan;
};

module.exports = { PLANS, getPlan };
-- =====================================================
-- Update subscription plan prices to "market" values (PEN)
-- - Keeps yearly pricing as 2 months free (monthly * 10)
-- - Non-breaking: only updates existing rows
-- =====================================================

UPDATE subscription_plans
SET
  price_monthly = 49,
  price_yearly = 490
WHERE name = 'starter';

UPDATE subscription_plans
SET
  price_monthly = 99,
  price_yearly = 990
WHERE name = 'professional';

UPDATE subscription_plans
SET
  price_monthly = 199,
  price_yearly = 1990
WHERE name = 'enterprise';


-- Grants for Opportunities
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "opportunities" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "opportunities" TO service_role;

-- Grants for Pipeline Stages
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "pipeline_stages" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "pipeline_stages" TO service_role;

-- Grants for Tasks (if used in reports)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "tasks" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "tasks" TO service_role;

-- Grants for Opportunity Products
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "opportunity_products" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "opportunity_products" TO service_role;

-- Ensure sequences are accessible (if any)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

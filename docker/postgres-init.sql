-- Runs once, when the postgres volume is created.
-- Separate database for integration tests: they truncate tables, so never point them at dev data.
CREATE DATABASE genius_land_test;

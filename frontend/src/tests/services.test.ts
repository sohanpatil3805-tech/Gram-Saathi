import { describe, it, expect } from 'vitest';
import { mockService } from '../services/mockService';
import { kn } from '../translations/kn';
import { hi } from '../translations/hi';

describe('Gram Saathi - Core Frontend Services & Mocks', () => {
  it('should fetch schemes and filter by target_group', async () => {
    const all = await mockService.getSchemes();
    expect(all.length).toBeGreaterThan(0);

    const farmers = await mockService.getSchemes({ target_group: 'FARMER' });
    expect(farmers.length).toBeGreaterThan(0);
    expect(farmers.every((s) => s.target_group === 'FARMER')).toBe(true);
  });

  it('should deterministically assess eligibility for small farmers (PM-KISAN)', async () => {
    // Ramu Nayak synthetic profile (1.5 acres, farmer, active bank account)
    const eligibleResult = await mockService.assessEligibility('sch-pm-kisan-01', {
      citizen_group: 'FARMER',
      annual_income: 80000,
      land_holding_acres: 1.5,
      has_bank_account: true,
    });

    expect(eligibleResult.eligible).toBe(true);
    expect(eligibleResult.score).toBe(100);
    expect(eligibleResult.unmet_criteria.length).toBe(0);

    // Ineligible profile (6 acres land exceeds 5 acre ceiling)
    const ineligibleResult = await mockService.assessEligibility('sch-pm-kisan-01', {
      citizen_group: 'FARMER',
      annual_income: 80000,
      land_holding_acres: 6.0,
      has_bank_account: true,
    });

    expect(ineligibleResult.eligible).toBe(false);
    expect(ineligibleResult.unmet_criteria.length).toBeGreaterThan(0);
  });

  it('should verify document and extract masked Aadhaar via simulated local OCR', async () => {
    const ocrResult = await mockService.uploadAndProcessDocument('valid_aadhaar');
    expect(ocrResult.validation_status).toBe('VALID');
    expect(ocrResult.confidence_score).toBeGreaterThanOrEqual(90);
    expect(ocrResult.extracted_fields.masked_aadhaar).toMatch(/^XXXX-XXXX-\d{4}$/);
  });

  it('should correctly flag blurry images with NEEDS_CORRECTION', async () => {
    const blurryResult = await mockService.uploadAndProcessDocument('blurry_document');
    expect(blurryResult.validation_status).toBe('NEEDS_CORRECTION');
    expect(blurryResult.confidence_score).toBeLessThan(50);
  });

  it('should generate a 5-minute single-use confirmation token and submit application with SIM- prefix', async () => {
    const preview = await mockService.generateApplicationPreview('sch-pm-kisan-01', {
      citizen_group: 'FARMER',
      annual_income: 80000,
      land_holding_acres: 1.5,
      has_bank_account: true,
    });

    expect(preview.confirmation_token).toBeDefined();
    expect(preview.ttl_seconds).toBe(300);

    const submission = await mockService.submitApplication(
      preview.application_id,
      preview.confirmation_token,
      preview
    );

    expect(submission.submission_reference).toMatch(/^SIM-\d{4}-\d+$/);
    expect(submission.is_simulated).toBe(true);
    expect(submission.status).toBe('SUBMITTED');
  });

  it('should maintain 100% key parity between Kannada and Hindi translations', () => {
    const knKeys = Object.keys(kn).sort();
    const hiKeys = Object.keys(hi).sort();

    expect(knKeys).toEqual(hiKeys);
    expect(knKeys.length).toBeGreaterThan(40);
  });
});

import { z } from 'zod';

/**
 * Zod validation schema for Step 1 of the multi-step application wizard:
 * requires both an active resume and a parsed job description.
 */
export const applyStep1Schema = z.object({
  resumeId: z
    .string()
    .trim()
    .min(1, 'Please select or upload a resume before proceeding to tailoring'),
  jobDescriptionId: z
    .string()
    .trim()
    .min(1, 'Please select or paste a job description before proceeding to tailoring'),
});

export default {
  applyStep1Schema,
};

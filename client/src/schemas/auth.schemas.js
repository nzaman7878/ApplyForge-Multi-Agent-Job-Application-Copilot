import { z } from 'zod';

/**
 * Zod validation schema for user login.
 */
export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Must be a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

/**
 * Zod validation schema for user registration.
 */
export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Name is required')
      .min(2, 'Name must be between 2 and 50 characters')
      .max(50, 'Name must be between 2 and 50 characters'),
    email: z.string().trim().min(1, 'Email is required').email('Must be a valid email address'),
    password: z
      .string()
      .min(1, 'Password is required')
      .min(8, 'Password must be at least 8 characters long'),
    confirmPassword: z.string().optional().or(z.literal('')),
  })
  .refine((data) => !data.confirmPassword || data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export default {
  loginSchema,
  registerSchema,
};

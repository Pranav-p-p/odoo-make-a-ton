// Core: auth request bodies (AUTH-1…AUTH-3). Same schemas validate the forms and the API.
import { z } from 'zod';
import { email, name, password } from './common';

export const signupSchema = z.object({ full_name: name, email, password });
export const loginSchema = z.object({ email, password: z.string().min(1, 'is required') });
export const forgotPasswordSchema = z.object({ email });
/** token_hash comes from the emailed link; without it, the signed-in user's password is changed. */
export const resetPasswordSchema = z.object({ password, token_hash: z.string().min(10).optional() });

import { Schema, model } from 'mongoose';
import { z } from 'zod';

export const zUserSchema = z.object({
  name: z.string(),
  email: z.string(),
  emailVerified: z.boolean(),
  image: z.string().optional(),
  role: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const zUserCreateSchema = zUserSchema.omit({
  createdAt: true,
  updatedAt: true,
});

export type User = z.infer<typeof zUserSchema>;
export type UserCreate = z.infer<typeof zUserCreateSchema>;

const userSchema = new Schema<User>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    emailVerified: { type: Boolean, required: true },
    image: { type: String, required: false },
    role: { type: String, required: false },
  },
  { timestamps: true }
);

export const UserModel = model<User>('user', userSchema);

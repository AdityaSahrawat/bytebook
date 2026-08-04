import { z, ZodSchema } from 'zod';
import { Side, Type } from '../types';

export const createOrderSchema = z.object({
  side: z.nativeEnum(Side, { required_error: 'Side must be BUY or SELL' }),
  type: z.nativeEnum(Type, { required_error: 'Type must be LIMIT or MARKET' }),
  quantity: z
    .number({ required_error: 'Quantity is required' })
    .positive('Quantity must be greater than zero'),
  price: z.number().positive('Price must be greater than zero').optional(),
});

export function validateOrderInput(data: unknown) {
  return createOrderSchema.safeParse(data);
}

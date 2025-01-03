'use server';

import { z } from 'zod';
import { sql } from '@vercel/postgres';
import { expirePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { InvoiceForm } from './definitions';

import { signIn } from '@/auth';
import { AuthError } from 'next-auth';

const FormSchema = z.object({
  id: z.string(),
  customer_id: z.string({
    invalid_type_error: 'Please select a customer.',
  }),
  amount: z.coerce
    .number()
    .gt(0, { message: 'Please enter an amount greater than $0.' }),

  status: z.enum(['pending', 'paid'], {
    invalid_type_error: 'Please select an invoice status.',
  }
  ),
  date: z.string(),
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });

const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export type State = {
  errors?: {
    customer_id?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
  data?: {
    customer_id: FormDataEntryValue | null,
    amount: FormDataEntryValue | null,
    status: FormDataEntryValue | null,
  } | InvoiceForm;
};

export async function createInvoice(prevState: State, formData: FormData) : Promise<State> {

  const values = {
    customer_id: formData.get('customer_id'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  };

  // Validate form using Zod
  const validatedFields = CreateInvoice.safeParse(values);

  // If form validation fails, return errors early. Otherwise, continue.
  if (!validatedFields.success) {

    const fieldErrors = validatedFields.error.flatten().fieldErrors;

    return {
      errors: fieldErrors,
      message: 'Missing Fields. Failed to Create Invoice.',
      data: values
    };
  }

  // Prepare data for insertion into the database
  const { customer_id, amount, status } = validatedFields.data;
  const amountInCents = amount * 100;
  const date = new Date().toISOString().split('T')[0];

  // Insert data into the database
  try {
    await sql`
      INSERT INTO invoices (customer_id, amount, status, date)
      VALUES (${customer_id}, ${amountInCents}, ${status}, ${date})
    `;

  } catch (error) {
    // If a database error occurs, return a more specific error.
    return {
      message: `Database Error: ${error}. Failed to Create Invoice.`,
    };
  }

  // seta o cookie e coloca um tempo para expirar (maxAge (segundos))
  // 1 segundo para que a outra página consiga ler o cookie a tempo
  (await cookies()).set('invoiceCreated', 'true', { maxAge: 1 })

  // Revalidate the cache for the invoices page and redirect the user.
  expirePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

export async function updateInvoice(id: string, prevState: State, formData: FormData): Promise<State> {

  const values = {
    customer_id: formData.get('customer_id'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  };

  const validatedFields = UpdateInvoice.safeParse(values);

  // If form validation fails, return errors early. Otherwise, continue.
  if (!validatedFields.success) {

    let fieldErrors = validatedFields.error.flatten().fieldErrors;

    return {
      errors: fieldErrors,
      message: 'Missing Fields. Failed to Update Invoice.',
      data: values
    };
  }

  const { customer_id, amount, status } = validatedFields.data;

  const amountInCents = amount * 100;

  try {
    await sql`
        UPDATE invoices
        SET customer_id = ${customer_id}, amount = ${amountInCents}, status = ${status}
        WHERE id = ${id}
      `;
  } catch (error) {
    return { message: 'Database Error: Failed to Update Invoice.' };
  }

  // seta o cookie e coloca um tempo para expirar (maxAge (segundos))
  // 1 segundo para que a outra página consiga ler o cookie a tempo
  (await cookies()).set('invoiceUpdated', 'true', { maxAge: 1 });

  expirePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string) {
  try {
    await sql`DELETE FROM invoices WHERE id = ${id}`;
    expirePath('/dashboard/invoices');
    return { message: 'Deleted Invoice.' };
  } catch (error) {
    return { message: 'Database Error: Failed to Delete Invoice.' };
  }
}

export async function authenticate(
  prevState: string | undefined,
  formData: FormData,
) {
  try {
    await signIn('credentials', formData);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return 'Invalid credentials.';
        default:
          return 'Something went wrong.';
      }
    }
    throw error;
  }
}
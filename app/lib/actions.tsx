'use server';

import { z } from 'zod';

import { sql } from '@vercel/postgres';

import { expirePath } from 'next/cache';

import { redirect } from 'next/navigation';

const FormSchema = z.object({
  id: z.string(),
  customerId: z.string({
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
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
  data?: {
    customerId: FormDataEntryValue | null,
    amount: FormDataEntryValue | null,
    status: FormDataEntryValue | null,
  };
};

export async function createInvoice(prevState: State, formData: FormData) {

  let values = {
    customerId: formData.get('customerId'),
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
  const { customerId, amount, status } = validatedFields.data;
  const amountInCents = amount * 100;
  const date = new Date().toISOString().split('T')[0];

  // Insert data into the database
  try {
    await sql`
      INSERT INTO invoices (customer_id, amount, status, date)
      VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
    `;

  } catch (error) {
    // If a database error occurs, return a more specific error.
    return {
      message: `Database Error: ${error}. Failed to Create Invoice.`,
    };
  }

  // Revalidate the cache for the invoices page and redirect the user.
  expirePath('/dashboard/invoices');
  redirect('/dashboard/invoices?invoiceCreated=true');
}

export async function updateInvoice(id: string, formData: FormData) {

  const { customerId, amount, status } = UpdateInvoice.parse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  const amountInCents = amount * 100;

  try {
    await sql`
        UPDATE invoices
        SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
        WHERE id = ${id}
      `;
  } catch (error) {
    return { message: 'Database Error: Failed to Update Invoice.' };
  }

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
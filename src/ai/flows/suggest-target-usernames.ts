'use server';

/**
 * @fileOverview A flow that suggests relevant target usernames based on the user's account name.
 *
 * - suggestTargetUsernames - A function that suggests target usernames.
 * - SuggestTargetUsernamesInput - The input type for the suggestTargetUsernames function.
 * - SuggestTargetUsernamesOutput - The return type for the suggestTargetUsernames function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestTargetUsernamesInputSchema = z.object({
  accountName: z.string().describe('The name of the user account.'),
});
export type SuggestTargetUsernamesInput = z.infer<typeof SuggestTargetUsernamesInputSchema>;

const SuggestTargetUsernamesOutputSchema = z.object({
  suggestedUsernames: z
    .array(z.string())
    .describe('An array of suggested target usernames.'),
});
export type SuggestTargetUsernamesOutput = z.infer<typeof SuggestTargetUsernamesOutputSchema>;

export async function suggestTargetUsernames(
  input: SuggestTargetUsernamesInput
): Promise<SuggestTargetUsernamesOutput> {
  return suggestTargetUsernamesFlow(input);
}

const suggestTargetUsernamesPrompt = ai.definePrompt({
  name: 'suggestTargetUsernamesPrompt',
  input: {schema: SuggestTargetUsernamesInputSchema},
  output: {schema: SuggestTargetUsernamesOutputSchema},
  prompt: `You are a social media expert. Given an account name, you will suggest a list of relevant target usernames. Return a JSON array of usernames.

Account Name: {{{accountName}}}`,
});

const suggestTargetUsernamesFlow = ai.defineFlow(
  {
    name: 'suggestTargetUsernamesFlow',
    inputSchema: SuggestTargetUsernamesInputSchema,
    outputSchema: SuggestTargetUsernamesOutputSchema,
  },
  async input => {
    const {output} = await suggestTargetUsernamesPrompt(input);
    return output!;
  }
);

"use server";

import { z } from "zod";
import {
  suggestTargetUsernames,
  type SuggestTargetUsernamesInput,
} from "@/ai/flows/suggest-target-usernames";
import { db } from "@/lib/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

const accountSchema = z.object({
  uid: z.string(),
  name: z.string().min(2),
  bearerToken: z.string().min(10),
  targets: z.string().optional(),
  followerTarget: z.number().min(0),
  enableFollowBackGoal: z.boolean(),
  initialFollowers: z.number().min(0),
});

export async function addAccount(data: z.infer<typeof accountSchema>) {
  const validatedData = accountSchema.safeParse(data);
  if (!validatedData.success) {
    throw new Error("Invalid account data provided.");
  }

  const {
    uid,
    name,
    bearerToken,
    targets,
    followerTarget,
    enableFollowBackGoal,
    initialFollowers,
  } = validatedData.data;

  try {
    await addDoc(collection(db, "accounts"), {
      uid,
      name,
      bearerToken,
      active: true,
      targetUsernames: targets
        ? targets
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
      followerTarget,
      enableFollowBackGoal,
      initialFollowers,
      createdAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error: any) {
    console.error("Failed to add account:", error);
    throw new Error("Failed to save account to database.");
  }
}

export async function getUsernameSuggestions(
  input: SuggestTargetUsernamesInput
) {
  try {
    return await suggestTargetUsernames(input);
  } catch (error) {
    console.error("AI suggestion error:", error);
    throw new Error("Could not fetch AI suggestions.");
  }
}

export async function getInitialFollowers(
  bearerToken: string
): Promise<{ count: number }> {
  try {
    const response = await fetch(
      "https://api.ecox.network/api/v1/user/list-follow?offset=1&limit=1&type=follower",
      {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch followers: ${response.status}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(`API error fetching followers: ${JSON.stringify(data)}`);
    }

    return { count: data.total ?? 0 };
  } catch (error) {
    console.error("Error fetching initial followers:", error);
    throw new Error("Could not retrieve initial follower count.");
  }
}